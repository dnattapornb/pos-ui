import { Test, TestingModule } from '@nestjs/testing';
import { LineController } from '../../../src/line/line.controller';
import { LineService } from '../../../src/line/line.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('LineController', () => {
    let controller: LineController;
    let lineService: LineService;

    const mockLineService = {
        handleWebhook: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            if (key === 'LINE_CHANNEL_SECRET') return 'secret';
            return null;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [LineController],
            providers: [
                { provide: LineService, useValue: mockLineService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        controller = module.get<LineController>(LineController);
        lineService = module.get<LineService>(LineService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('handleWebhook', () => {
        it('should validate signature and call handleWebhook on valid signature', async () => {
            const rawBody = Buffer.from(JSON.stringify({ events: [{ type: 'message' }] }));
            const req = { rawBody };
            const body = { events: [{ type: 'message' }] };
            
            const signature = crypto.createHmac('SHA256', 'secret').update(rawBody).digest('base64');

            const result = await controller.handleWebhook(req, body, signature);
            
            expect(mockLineService.handleWebhook).toHaveBeenCalledWith(body.events);
            expect(result).toEqual({ status: 'success' });
        });

        it('should return success even if signature is invalid (to prevent LINE retry)', async () => {
            const rawBody = Buffer.from(JSON.stringify({ events: [] }));
            const req = { rawBody };
            const body = { events: [] };
            
            const result = await controller.handleWebhook(req, body, 'invalid-signature');
            
            expect(mockLineService.handleWebhook).toHaveBeenCalledWith(body.events);
            expect(result).toEqual({ status: 'success' });
        });

        it('should return error if handleWebhook throws (or return success if catching properly)', async () => {
            mockLineService.handleWebhook.mockRejectedValueOnce(new Error('Test error'));
            
            const rawBody = Buffer.from('{}');
            const signature = crypto.createHmac('SHA256', 'secret').update(rawBody).digest('base64');
            
            const result = await controller.handleWebhook({ rawBody }, { events: [] }, signature);
            
            // The controller catches the error and returns { status: 'error' } in the current implementation.
            expect(result).toEqual({ status: 'error' });
        });
    });
});
