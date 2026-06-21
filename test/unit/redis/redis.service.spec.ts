import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../src/redis/redis.service';

interface MockRedisClient {
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
}

jest.mock('ioredis', () => {
  const client: MockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };
  return {
    __esModule: true,
    default: jest.fn(() => client),
    mockClient: client,
  };
});

const { mockClient } = jest.requireMock<{ mockClient: MockRedisClient }>(
  'ioredis',
);

describe('RedisService', () => {
  let service: RedisService;

  const config = {
    get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
  } as unknown as ConfigService;

  beforeEach(() => {
    service = new RedisService(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns the value on CACHE HIT', async () => {
      mockClient.get.mockResolvedValueOnce('{"a":1}');

      const res = await service.get('pos:barcode:8850001');

      expect(mockClient.get).toHaveBeenCalledWith('pos:barcode:8850001');
      expect(res).toBe('{"a":1}');
    });

    it('returns null on CACHE MISS', async () => {
      mockClient.get.mockResolvedValueOnce(null);

      const res = await service.get('pos:barcode:0000000');

      expect(res).toBeNull();
    });

    it('returns null gracefully when Redis throws', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('connection refused'));

      const res = await service.get('pos:barcode:8850001');

      expect(res).toBeNull();
    });
  });

  describe('set', () => {
    it('calls setex with the correct key, ttl and value', async () => {
      mockClient.setex.mockResolvedValueOnce('OK');

      await service.set('pos:barcode:8850001', '{"a":1}', 86400);

      expect(mockClient.setex).toHaveBeenCalledWith(
        'pos:barcode:8850001',
        86400,
        '{"a":1}',
      );
    });

    it('does not throw when Redis fails', async () => {
      mockClient.setex.mockRejectedValueOnce(new Error('down'));

      await expect(
        service.set('pos:barcode:8850001', '{}', 86400),
      ).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('calls del with the correct key', async () => {
      mockClient.del.mockResolvedValueOnce(1);

      await service.del('pos:barcode:8850001');

      expect(mockClient.del).toHaveBeenCalledWith('pos:barcode:8850001');
    });

    it('does not throw when Redis fails', async () => {
      mockClient.del.mockRejectedValueOnce(new Error('down'));

      await expect(service.del('pos:barcode:8850001')).resolves.toBeUndefined();
    });
  });

  describe('delPattern', () => {
    it('uses SCAN then DEL on the matched keys', async () => {
      mockClient.scan
        .mockResolvedValueOnce(['10', ['pos:barcode:1', 'pos:barcode:2']])
        .mockResolvedValueOnce(['0', ['pos:barcode:3']]);
      mockClient.del.mockResolvedValue(1);

      await service.delPattern('pos:barcode:*');

      expect(mockClient.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'pos:barcode:*',
        'COUNT',
        100,
      );
      expect(mockClient.scan).toHaveBeenNthCalledWith(
        2,
        '10',
        'MATCH',
        'pos:barcode:*',
        'COUNT',
        100,
      );
      expect(mockClient.del).toHaveBeenCalledWith(
        'pos:barcode:1',
        'pos:barcode:2',
      );
      expect(mockClient.del).toHaveBeenCalledWith('pos:barcode:3');
    });

    it('skips DEL when no keys match', async () => {
      mockClient.scan.mockResolvedValueOnce(['0', []]);

      await service.delPattern('pos:barcode:*');

      expect(mockClient.del).not.toHaveBeenCalled();
    });

    it('does not throw when Redis fails', async () => {
      mockClient.scan.mockRejectedValueOnce(new Error('down'));

      await expect(
        service.delPattern('pos:barcode:*'),
      ).resolves.toBeUndefined();
    });
  });
});
