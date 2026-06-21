import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { Inventory } from './entities/inventory.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { Category } from './entities/category.entity';
import { Supplier } from './entities/supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductUnit,
      Inventory,
      InventoryTransaction,
      Category,
      Supplier,
      PurchaseOrder,
      Order,
      OrderItem,
    ]),
  ],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
