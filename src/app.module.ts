import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LineModule } from './line/line.module';
import { OcrModule } from './ocr/ocr.module';
import { ReceiptModule } from './receipt/receipt.module';
import { AuthModule } from './auth/auth.module';
import { Receipt } from './receipt/receipt.entity';
import { ReceiptItem } from './receipt/receipt-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('MYSQL_HOST', 'localhost'),
        port: cfg.get<number>('MYSQL_PORT', 4306),
        username: cfg.get<string>('MYSQL_USER', 'root'),
        password: cfg.get<string>('MYSQL_PASSWORD', 'root'),
        database: cfg.get<string>('MYSQL_DATABASE', 'pos'),
        entities: [Receipt, ReceiptItem],
        synchronize: true, // Only for development
      }),
    }),
    LineModule,
    OcrModule,
    ReceiptModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
