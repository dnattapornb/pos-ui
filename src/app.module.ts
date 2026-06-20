import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LineModule } from './line/line.module';
import { OcrModule } from './ocr/ocr.module';
import { ReceiptModule } from './receipt/receipt.module';
import { AuthModule } from './auth/auth.module';
import { PosModule } from './pos/pos.module';
import { Receipt } from './receipt/receipt.entity';
import { ReceiptItem } from './receipt/receipt-item.entity';
import { Product } from './pos/entities/product.entity';
import { ProductUnit } from './pos/entities/product-unit.entity';
import { Inventory } from './pos/entities/inventory.entity';
import { InventoryTransaction } from './pos/entities/inventory-transaction.entity';

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
        // Read/write DATETIME as UTC. Prevents the mysql2 driver from applying a
        // local (+07) offset, keeping timestamps consistent end-to-end.
        timezone: 'Z',
        entities: [Receipt, ReceiptItem, Product, ProductUnit, Inventory, InventoryTransaction],
        synchronize: true, // Only for development
      }),
    }),
    LineModule,
    OcrModule,
    ReceiptModule,
    AuthModule,
    PosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
