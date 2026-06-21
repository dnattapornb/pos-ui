import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const password = this.config.get<string>('REDIS_PASSWORD');
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      ...(password ? { password } : {}),
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
  }

  onModuleInit(): void {
    this.client.on('error', (err: Error) => {
      this.logger.warn(`[Redis] connection error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      if (value !== null) {
        this.logger.log('[Redis] ✓ CACHE HIT!');
      } else {
        this.logger.log('[Redis] ✗ CACHE MISS!');
      }
      return value;
    } catch (err) {
      this.logger.warn(`[Redis] GET failed for "${key}": ${this.message(err)}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, value);
    } catch (err) {
      this.logger.warn(`[Redis] SET failed for "${key}": ${this.message(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`[Redis] DEL failed for "${key}": ${this.message(err)}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `[Redis] DEL pattern failed for "${pattern}": ${this.message(err)}`,
      );
    }
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
