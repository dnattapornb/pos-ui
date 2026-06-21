import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { Inventory } from './entities/inventory.entity';
import { Category } from './entities/category.entity';
import {
  InventoryTransaction,
  TransactionType,
} from './entities/inventory-transaction.entity';
import { Supplier } from './entities/supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderStatus } from './enums/purchase-order-status.enum';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PaymentMethod } from './enums/payment-method.enum';
import { OrderStatus } from './enums/order-status.enum';
import {
  CheckoutDto,
  CreateProductDto,
  UpdateProductDto,
  AddProductUnitDto,
  UpdateProductUnitDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
} from './dto/pos.dto';
import { UnitName } from './enums/unit.enum';

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
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  async getAllCategories() {
    return this.categoryRepo.find();
  }

  async getCategoryById(id: number) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    try {
      const category = this.categoryRepo.create({ name: dto.name });
      await this.categoryRepo.save(category);
      this.logger.log(`Created category ${category.id}`);
      return category;
    } catch (err) {
      this.logger.error(`Create category failed: ${err}`);
      throw new BadRequestException(
        'Failed to create category (name might already exist)',
      );
    }
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.getCategoryById(id);
    if (dto.name) {
      category.name = dto.name;
    }
    try {
      await this.categoryRepo.save(category);
      this.logger.log(`Updated category ${id}`);
      return category;
    } catch (err) {
      this.logger.error(`Update category failed: ${err}`);
      throw new BadRequestException('Failed to update category');
    }
  }

  async deleteCategory(id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: { products: true },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    if (category.products && category.products.length > 0) {
      throw new BadRequestException('Cannot delete category with products');
    }
    await this.categoryRepo.remove(category);
    this.logger.log(`Deleted category ${id}`);
    return { message: `Category ${id} has been deleted` };
  }

  async getAllProducts() {
    return this.productRepo.find({
      where: { published: true },
      relations: { units: true, inventory: true },
    });
  }

  async getProductById(id: number) {
    const product = await this.productRepo.findOne({
      where: { id, published: true },
      relations: { units: true, inventory: true, category: true },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let productId: number;
    try {
      // 1. Create Product
      let category = null;
      if (dto.categoryId) {
        category = await queryRunner.manager.findOne(Category, {
          where: { id: dto.categoryId },
        });
        if (!category) {
          throw new BadRequestException('Category not found');
        }
      }

      const product = this.productRepo.create({
        sku: dto.sku,
        name: dto.name,
        baseUnitName: dto.baseUnitName,
        costPrice: dto.costPrice,
        category: category,
      });
      await queryRunner.manager.save(product);

      // 2. Create Units
      if (dto.units && dto.units.length > 0) {
        for (const unitDto of dto.units) {
          const unit = this.unitRepo.create({
            product,
            barcode: unitDto.barcode,
            unitName: unitDto.unitName,
            multiplier: unitDto.multiplier,
            retailPrice: unitDto.retailPrice,
            wholesalePrice: unitDto.wholesalePrice,
          });
          await queryRunner.manager.save(unit);
        }
      }

      // 3. Create initial empty inventory
      const inventory = this.inventoryRepo.create({
        product,
        qtyInBaseUnit: 0,
      });
      await queryRunner.manager.save(inventory);

      await queryRunner.commitTransaction();
      productId = product.id;
      this.logger.log(`Created product ${product.id}`);
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Create product failed: ${err}`);
      throw new BadRequestException('Failed to create product');
    } finally {
      await queryRunner.release();
    }

    const createdProduct = await this.productRepo.findOne({
      where: { id: productId },
      relations: { units: true, inventory: true, category: true },
    });
    if (!createdProduct) {
      throw new BadRequestException('Product not found after creation');
    }
    return createdProduct;
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: { units: true },
      });

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      // Update Product fields
      if (dto.sku) product.sku = dto.sku;
      if (dto.name) product.name = dto.name;
      if (dto.baseUnitName) product.baseUnitName = dto.baseUnitName;
      if (dto.costPrice !== undefined) product.costPrice = dto.costPrice;
      if (dto.published !== undefined) product.published = dto.published;
      if (dto.categoryId !== undefined) {
        if (dto.categoryId === null) {
          product.category = null;
        } else {
          const category = await queryRunner.manager.findOne(Category, {
            where: { id: dto.categoryId },
          });
          if (!category) throw new BadRequestException('Category not found');
          product.category = category;
        }
      }

      await queryRunner.manager.save(product);

      // Upsert Units by barcode (no deletion of units missing from payload)
      if (dto.units) {
        const existingByBarcode = new Map(
          (product.units ?? []).map((unit) => [unit.barcode, unit]),
        );

        for (const unitDto of dto.units) {
          const existing = existingByBarcode.get(unitDto.barcode);
          if (existing) {
            // Update in place — keep id / createdAt, re-publish if previously soft-deleted
            existing.unitName = unitDto.unitName;
            existing.multiplier = unitDto.multiplier;
            existing.retailPrice = unitDto.retailPrice;
            existing.wholesalePrice = unitDto.wholesalePrice;
            existing.published = true;
            await queryRunner.manager.save(existing);
          } else {
            const unit = this.unitRepo.create({
              product,
              barcode: unitDto.barcode,
              unitName: unitDto.unitName,
              multiplier: unitDto.multiplier,
              retailPrice: unitDto.retailPrice,
              wholesalePrice: unitDto.wholesalePrice,
            });
            await queryRunner.manager.save(unit);
          }
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Updated product ${product.id}`);
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Update product failed: ${err}`);
      throw new BadRequestException('Failed to update product');
    } finally {
      await queryRunner.release();
    }

    const updatedProduct = await this.productRepo.findOne({
      where: { id },
      relations: { units: true, inventory: true, category: true },
    });
    if (!updatedProduct) {
      throw new BadRequestException('Product not found after update');
    }
    return updatedProduct;
  }

  async deleteProduct(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { units: true },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }

    product.published = false;
    await this.productRepo.save(product);

    // Also soft delete units if applicable (since we added published to product_unit as well)
    if (product.units && product.units.length > 0) {
      for (const unit of product.units) {
        unit.published = false;
      }
      await this.unitRepo.save(product.units);
    }

    this.logger.log(`Soft deleted product ${id}`);
    return { message: `Product ${id} has been deleted` };
  }

  async getProductUnitById(id: number) {
    const unit = await this.unitRepo.findOne({
      where: { id, published: true },
      relations: { product: true },
    });
    if (!unit) {
      throw new BadRequestException('Product unit not found');
    }
    return unit;
  }

  async createProductUnit(dto: AddProductUnitDto) {
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }

    try {
      const unit = this.unitRepo.create({
        product,
        barcode: dto.barcode,
        unitName: dto.unitName,
        multiplier: dto.multiplier,
        retailPrice: dto.retailPrice,
        wholesalePrice: dto.wholesalePrice,
      });
      await this.unitRepo.save(unit);
      this.logger.log(`Created product unit ${unit.id}`);
      return this.getProductUnitById(unit.id);
    } catch (err) {
      this.logger.error(`Create product unit failed: ${err}`);
      throw new BadRequestException('Failed to create product unit');
    }
  }

  async updateProductUnit(id: number, dto: UpdateProductUnitDto) {
    const unit = await this.unitRepo.findOne({ where: { id } });
    if (!unit) {
      throw new BadRequestException('Product unit not found');
    }

    if (dto.barcode) unit.barcode = dto.barcode;
    if (dto.unitName) unit.unitName = dto.unitName;
    if (dto.multiplier !== undefined) unit.multiplier = dto.multiplier;
    if (dto.retailPrice !== undefined) unit.retailPrice = dto.retailPrice;
    if (dto.wholesalePrice !== undefined)
      unit.wholesalePrice = dto.wholesalePrice;
    if (dto.published !== undefined) unit.published = dto.published;

    await this.unitRepo.save(unit);
    this.logger.log(`Updated product unit ${id}`);
    return unit;
  }

  async deleteProductUnit(id: number) {
    const unit = await this.unitRepo.findOne({ where: { id } });
    if (!unit) {
      throw new BadRequestException('Product unit not found');
    }

    unit.published = false;
    await this.unitRepo.save(unit);

    this.logger.log(`Soft deleted product unit ${id}`);
    return { message: `Product unit ${id} has been deleted` };
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
      const p1 = this.productRepo.create({
        sku: 'SKU-001',
        name: 'น้ำอัดลม 325 มล.',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 12,
      });
      await queryRunner.manager.save(p1);
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p1,
          barcode: '8850001',
          unitName: UnitName.BOTTLE,
          multiplier: 1,
          retailPrice: 15,
          wholesalePrice: 14,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p1,
          barcode: '8850002',
          unitName: UnitName.PACK,
          multiplier: 6,
          retailPrice: 85,
          wholesalePrice: 80,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p1,
          barcode: '8850003',
          unitName: UnitName.CARTON,
          multiplier: 24,
          retailPrice: 330,
          wholesalePrice: 310,
        }),
      );
      await queryRunner.manager.save(
        this.inventoryRepo.create({ product: p1, qtyInBaseUnit: 48 }),
      ); // 2 cartons

      // Product 2: Instant Noodle (Sachet, Pack, Carton) -> 1 Carton = 4 Packs = 40 Sachets
      const p2 = this.productRepo.create({
        sku: 'SKU-002',
        name: 'บะหมี่กึ่งสำเร็จรูป รสหมูสับ',
        baseUnitName: UnitName.SACHET,
        costPrice: 5,
      });
      await queryRunner.manager.save(p2);
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p2,
          barcode: '8850004',
          unitName: UnitName.SACHET,
          multiplier: 1,
          retailPrice: 7,
          wholesalePrice: 6,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p2,
          barcode: '8850005',
          unitName: UnitName.PACK,
          multiplier: 10,
          retailPrice: 65,
          wholesalePrice: 60,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p2,
          barcode: '8850006',
          unitName: UnitName.CARTON,
          multiplier: 40,
          retailPrice: 250,
          wholesalePrice: 235,
        }),
      );
      await queryRunner.manager.save(
        this.inventoryRepo.create({ product: p2, qtyInBaseUnit: 80 }),
      ); // 2 cartons

      // Product 3: UHT Milk (Box, Pack, Carton)
      const p3 = this.productRepo.create({
        sku: 'SKU-003',
        name: 'นม UHT รสจืด 225 มล.',
        baseUnitName: UnitName.BOX,
        costPrice: 9,
      });
      await queryRunner.manager.save(p3);
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p3,
          barcode: '8850007',
          unitName: UnitName.BOX,
          multiplier: 1,
          retailPrice: 12,
          wholesalePrice: 11,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p3,
          barcode: '8850008',
          unitName: UnitName.PACK,
          multiplier: 4,
          retailPrice: 46,
          wholesalePrice: 42,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p3,
          barcode: '8850009',
          unitName: UnitName.CARTON,
          multiplier: 36,
          retailPrice: 400,
          wholesalePrice: 380,
        }),
      );
      await queryRunner.manager.save(
        this.inventoryRepo.create({ product: p3, qtyInBaseUnit: 0 }),
      );

      // Product 4: Drinking Water (Bottle, Pack)
      const p4 = this.productRepo.create({
        sku: 'SKU-004',
        name: 'น้ำดื่ม 600 มล.',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 4,
      });
      await queryRunner.manager.save(p4);
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p4,
          barcode: '8850010',
          unitName: UnitName.BOTTLE,
          multiplier: 1,
          retailPrice: 7,
          wholesalePrice: 6,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p4,
          barcode: '8850011',
          unitName: UnitName.PACK,
          multiplier: 12,
          retailPrice: 60,
          wholesalePrice: 55,
        }),
      );
      await queryRunner.manager.save(
        this.inventoryRepo.create({ product: p4, qtyInBaseUnit: 120 }),
      ); // 10 packs

      // Product 5: Energy Drink (Bottle, Pack)
      const p5 = this.productRepo.create({
        sku: 'SKU-005',
        name: 'เครื่องดื่มชูกำลัง',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 8,
      });
      await queryRunner.manager.save(p5);
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p5,
          barcode: '8850012',
          unitName: UnitName.BOTTLE,
          multiplier: 1,
          retailPrice: 10,
          wholesalePrice: 9,
        }),
      );
      await queryRunner.manager.save(
        this.unitRepo.create({
          product: p5,
          barcode: '8850013',
          unitName: UnitName.PACK,
          multiplier: 10,
          retailPrice: 95,
          wholesalePrice: 85,
        }),
      );
      await queryRunner.manager.save(
        this.inventoryRepo.create({ product: p5, qtyInBaseUnit: 50 }),
      ); // 5 packs

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

  async getAllSuppliers() {
    return this.supplierRepo.find();
  }

  async getSupplierById(id: number) {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    try {
      const supplier = this.supplierRepo.create(dto);
      await this.supplierRepo.save(supplier);
      this.logger.log(`Created supplier ${supplier.id}`);
      return supplier;
    } catch (err) {
      this.logger.error(`Create supplier failed: ${err}`);
      throw new BadRequestException('Failed to create supplier');
    }
  }

  async updateSupplier(id: number, dto: UpdateSupplierDto) {
    const supplier = await this.getSupplierById(id);
    if (dto.name) supplier.name = dto.name;
    if (dto.contactInfo !== undefined) supplier.contactInfo = dto.contactInfo;

    try {
      await this.supplierRepo.save(supplier);
      this.logger.log(`Updated supplier ${id}`);
      return supplier;
    } catch (err) {
      this.logger.error(`Update supplier failed: ${err}`);
      throw new BadRequestException('Failed to update supplier');
    }
  }

  async deleteSupplier(id: number) {
    const supplier = await this.getSupplierById(id);
    await this.supplierRepo.remove(supplier);
    this.logger.log(`Deleted supplier ${id}`);
    return { message: `Supplier ${id} has been deleted` };
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let supplier = null;
      if (dto.supplierId) {
        supplier = await queryRunner.manager.findOne(Supplier, {
          where: { id: dto.supplierId },
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found');
        }
      }

      // 1. Create PurchaseOrder
      const poNo = `PO-${Date.now()}`;
      let totalAmount = 0;

      const purchaseOrder = new PurchaseOrder();
      purchaseOrder.poNo = poNo;
      if (supplier) {
        purchaseOrder.supplier = supplier;
      }
      purchaseOrder.status = PurchaseOrderStatus.COMPLETED;
      await queryRunner.manager.save(purchaseOrder);

      // 2. Process items
      for (const item of dto.items) {
        const unit = await queryRunner.manager.findOne(ProductUnit, {
          where: { barcode: item.barcode },
          relations: { product: true },
        });

        if (!unit) {
          throw new BadRequestException(`Barcode ${item.barcode} not found`);
        }

        const qtyInBase = item.qty * unit.multiplier;
        const itemCost =
          item.costPrice !== undefined
            ? item.costPrice
            : unit.product.costPrice;
        totalAmount += Number(itemCost) * item.qty;

        // Create Transaction
        const transaction = new InventoryTransaction();
        transaction.product = unit.product;
        transaction.type = TransactionType.IN;
        transaction.qty = qtyInBase;
        transaction.referenceId = poNo;
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
      }

      purchaseOrder.totalAmount = totalAmount;
      await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();
      this.logger.log(`Created purchase order ${poNo}`);
      return {
        message: 'Purchase order created successfully',
        poNo,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Create purchase order failed: ${err}`);
      throw new BadRequestException(
        (err as Error).message || 'Failed to create purchase order',
      );
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
      // 1. Create the Order header first so items can reference it
      const order = new Order();
      order.orderNo = referenceId;
      order.paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
      order.paymentStatus = OrderStatus.COMPLETED;
      order.discountAmount = dto.discountAmount ?? 0;
      if (dto.cashierId !== undefined) {
        order.cashierId = dto.cashierId;
      }
      await queryRunner.manager.save(order);

      let totalAmount = 0;

      // 2. Process each line item: price, stock lock, deduct, ledger
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
          throw new BadRequestException(
            `Insufficient stock for product ${unit.product.name} (Barcode: ${item.barcode})`,
          );
        }

        // Deduct stock
        inventory.qtyInBaseUnit -= qtyToDeduct;
        await queryRunner.manager.save(inventory);

        // Price calculation (retailPrice -> unitPrice -> subtotal)
        const unitPrice = Number(unit.retailPrice);
        const subtotal = unitPrice * item.qty;
        totalAmount += subtotal;

        // Create order item
        const orderItem = new OrderItem();
        orderItem.order = order;
        orderItem.productUnit = unit;
        orderItem.qty = item.qty;
        orderItem.unitPrice = unitPrice;
        orderItem.subtotal = subtotal;
        await queryRunner.manager.save(orderItem);

        // Record transaction
        const transaction = new InventoryTransaction();
        transaction.product = unit.product;
        transaction.type = TransactionType.OUT;
        transaction.qty = qtyToDeduct;
        transaction.referenceId = referenceId;
        await queryRunner.manager.save(transaction);
      }

      // 3. Finalize order totals
      const discountAmount = Number(order.discountAmount);
      if (discountAmount > totalAmount) {
        throw new BadRequestException(
          'Discount amount cannot exceed total amount',
        );
      }
      order.totalAmount = totalAmount;
      order.netAmount = totalAmount - discountAmount;
      await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();
      this.logger.log(`Checkout successful ${referenceId}`);
      return this.getOrderById(order.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Checkout failed: ${(err as Error).message}`);
      throw new BadRequestException((err as Error).message);
    } finally {
      await queryRunner.release();
    }
  }

  async getOrders() {
    return this.orderRepo.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderById(id: number) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: {
        items: { productUnit: { product: true } },
        cashier: true,
      },
    });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }
}
