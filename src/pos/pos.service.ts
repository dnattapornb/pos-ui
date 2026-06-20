import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { Inventory } from './entities/inventory.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';
import { ReceiveGoodsDto, CheckoutDto } from './dto/pos.dto';
import { v4 as uuidv4 } from 'uuid';
import { RetailUnit } from './enums/unit.enum';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductUnit)
    private readonly unitRepo: Repository<ProductUnit>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    private readonly dataSource: DataSource,
  ) {}

  async getAllProducts() {
    return this.productRepo.find({ relations: { units: true, inventory: true } });
  }

  async seedProducts() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Wipe tables before seeding
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0;');
    await queryRunner.query('TRUNCATE TABLE product_unit;');
    await queryRunner.query('TRUNCATE TABLE inventory_transaction;');
    await queryRunner.query('TRUNCATE TABLE inventory;');
    await queryRunner.query('TRUNCATE TABLE product;');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1;');

    await queryRunner.startTransaction();

    try {
      // Product 1: Coke (Bottle, Pack, Carton)
      const p1 = this.productRepo.create({ sku: 'SKU-001', name: 'น้ำอัดลม 325 มล.', baseUnitName: RetailUnit.BOTTLE, costPrice: 12 });
      await queryRunner.manager.save(p1);
      await queryRunner.manager.save(this.unitRepo.create({ product: p1, barcode: '8850001', unitName: RetailUnit.BOTTLE, multiplier: 1, retailPrice: 15, wholesalePrice: 14 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p1, barcode: '8850002', unitName: RetailUnit.PACK, multiplier: 6, retailPrice: 85, wholesalePrice: 80 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p1, barcode: '8850003', unitName: RetailUnit.CARTON, multiplier: 24, retailPrice: 330, wholesalePrice: 310 }));
      await queryRunner.manager.save(this.inventoryRepo.create({ product: p1, qtyInBaseUnit: 48 })); // 2 cartons

      // Product 2: Instant Noodle (Sachet, Pack, Carton) -> 1 Carton = 4 Packs = 40 Sachets
      const p2 = this.productRepo.create({ sku: 'SKU-002', name: 'บะหมี่กึ่งสำเร็จรูป รสหมูสับ', baseUnitName: RetailUnit.SACHET, costPrice: 5 });
      await queryRunner.manager.save(p2);
      await queryRunner.manager.save(this.unitRepo.create({ product: p2, barcode: '8850004', unitName: RetailUnit.SACHET, multiplier: 1, retailPrice: 7, wholesalePrice: 6 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p2, barcode: '8850005', unitName: RetailUnit.PACK, multiplier: 10, retailPrice: 65, wholesalePrice: 60 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p2, barcode: '8850006', unitName: RetailUnit.CARTON, multiplier: 40, retailPrice: 250, wholesalePrice: 235 }));
      await queryRunner.manager.save(this.inventoryRepo.create({ product: p2, qtyInBaseUnit: 80 })); // 2 cartons

      // Product 3: UHT Milk (Box, Pack, Carton)
      const p3 = this.productRepo.create({ sku: 'SKU-003', name: 'นม UHT รสจืด 225 มล.', baseUnitName: RetailUnit.BOX, costPrice: 9 });
      await queryRunner.manager.save(p3);
      await queryRunner.manager.save(this.unitRepo.create({ product: p3, barcode: '8850007', unitName: RetailUnit.BOX, multiplier: 1, retailPrice: 12, wholesalePrice: 11 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p3, barcode: '8850008', unitName: RetailUnit.PACK, multiplier: 4, retailPrice: 46, wholesalePrice: 42 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p3, barcode: '8850009', unitName: RetailUnit.CARTON, multiplier: 36, retailPrice: 400, wholesalePrice: 380 }));
      await queryRunner.manager.save(this.inventoryRepo.create({ product: p3, qtyInBaseUnit: 0 }));

      // Product 4: Drinking Water (Bottle, Pack)
      const p4 = this.productRepo.create({ sku: 'SKU-004', name: 'น้ำดื่ม 600 มล.', baseUnitName: RetailUnit.BOTTLE, costPrice: 4 });
      await queryRunner.manager.save(p4);
      await queryRunner.manager.save(this.unitRepo.create({ product: p4, barcode: '8850010', unitName: RetailUnit.BOTTLE, multiplier: 1, retailPrice: 7, wholesalePrice: 6 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p4, barcode: '8850011', unitName: RetailUnit.PACK, multiplier: 12, retailPrice: 60, wholesalePrice: 55 }));
      await queryRunner.manager.save(this.inventoryRepo.create({ product: p4, qtyInBaseUnit: 120 })); // 10 packs

      // Product 5: Energy Drink (Bottle, Pack)
      const p5 = this.productRepo.create({ sku: 'SKU-005', name: 'เครื่องดื่มชูกำลัง', baseUnitName: RetailUnit.BOTTLE, costPrice: 8 });
      await queryRunner.manager.save(p5);
      await queryRunner.manager.save(this.unitRepo.create({ product: p5, barcode: '8850012', unitName: RetailUnit.BOTTLE, multiplier: 1, retailPrice: 10, wholesalePrice: 9 }));
      await queryRunner.manager.save(this.unitRepo.create({ product: p5, barcode: '8850013', unitName: RetailUnit.PACK, multiplier: 10, retailPrice: 95, wholesalePrice: 85 }));
      await queryRunner.manager.save(this.inventoryRepo.create({ product: p5, qtyInBaseUnit: 50 })); // 5 packs

      await queryRunner.commitTransaction();
      this.logger.log('Seed products successful');
      return { message: 'Products seeded successfully' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Seed failed: ${err}`);
      throw new BadRequestException('Failed to seed products');
    } finally {
      await queryRunner.release();
    }
  }

  async receiveGoods(dto: ReceiveGoodsDto) {
    const unit = await this.unitRepo.findOne({
      where: { barcode: dto.barcode },
      relations: { product: true },
    });

    if (!unit) {
      throw new BadRequestException('Barcode not found');
    }

    const qtyInBase = dto.qty * unit.multiplier;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create Transaction
      const transaction = new InventoryTransaction();
      transaction.product = unit.product;
      transaction.type = TransactionType.IN;
      transaction.qty = qtyInBase;
      transaction.referenceId = `RCV-${Date.now()}`;
      await queryRunner.manager.save(transaction);

      // Update Inventory with locking
      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: { productId: unit.product.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (inventory) {
        inventory.qtyInBaseUnit += qtyInBase;
        await queryRunner.manager.save(inventory);
      } else {
        const newInv = new Inventory();
        newInv.product = unit.product;
        newInv.qtyInBaseUnit = qtyInBase;
        await queryRunner.manager.save(newInv);
      }

      await queryRunner.commitTransaction();
      return { message: 'Goods received successfully', qtyAdded: qtyInBase, unitName: unit.product.baseUnitName };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Receive goods failed: ${err}`);
      throw new BadRequestException('Failed to receive goods');
    } finally {
      await queryRunner.release();
    }
  }

  async checkout(dto: CheckoutDto) {
    const referenceId = dto.referenceId || `ORDER-${Date.now()}`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of dto.items) {
        const unit = await queryRunner.manager.findOne(ProductUnit, {
          where: { barcode: item.barcode },
          relations: { product: true },
        });

        if (!unit) {
          throw new BadRequestException(`Barcode ${item.barcode} not found`);
        }

        const qtyToDeduct = item.qty * unit.multiplier;

        // Lock inventory row
        const inventory = await queryRunner.manager.findOne(Inventory, {
          where: { productId: unit.product.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!inventory || inventory.qtyInBaseUnit < qtyToDeduct) {
          throw new BadRequestException(`Insufficient stock for product ${unit.product.name} (Barcode: ${item.barcode})`);
        }

        // Deduct stock
        inventory.qtyInBaseUnit -= qtyToDeduct;
        await queryRunner.manager.save(inventory);

        // Record transaction
        const transaction = new InventoryTransaction();
        transaction.product = unit.product;
        transaction.type = TransactionType.OUT;
        transaction.qty = qtyToDeduct;
        transaction.referenceId = referenceId;
        await queryRunner.manager.save(transaction);
      }

      await queryRunner.commitTransaction();
      return { message: 'Checkout successful', referenceId };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Checkout failed: ${(err as Error).message}`);
      throw new BadRequestException((err as Error).message);
    } finally {
      await queryRunner.release();
    }
  }
}
