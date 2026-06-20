import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from '../../../src/pos/pos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../../../src/pos/entities/product.entity';
import { ProductUnit } from '../../../src/pos/entities/product-unit.entity';
import { Inventory } from '../../../src/pos/entities/inventory.entity';
import { Category } from '../../../src/pos/entities/category.entity';
import { Supplier } from '../../../src/pos/entities/supplier.entity';
import { PurchaseOrder } from '../../../src/pos/entities/purchase-order.entity';
import { DataSource } from 'typeorm';
import { UnitName } from '../../../src/pos/enums/unit.enum';

describe('PosService', () => {
  let service: PosService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    },
    query: jest.fn(),
  };

  let unitRepo: { create: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let productRepo: { findOne: jest.Mock };
  let categoryRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let supplierRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            create: jest
              .fn()
              .mockImplementation((dto: Partial<Product>) => dto),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProductUnit),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((dto: Partial<ProductUnit>) => dto),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Inventory),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((dto: Partial<Inventory>) => dto),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest
              .fn()
              .mockImplementation((dto: Partial<Category>) => dto),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest
              .fn()
              .mockImplementation((dto: Partial<Supplier>) => dto),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<PosService>(PosService);
    unitRepo = module.get(getRepositoryToken(ProductUnit));
    productRepo = module.get(getRepositoryToken(Product));
    categoryRepo = module.get(getRepositoryToken(Category));
    supplierRepo = module.get(getRepositoryToken(Supplier));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('seedProducts', () => {
    it('should seed products if count is 0', async () => {
      const res = await service.seedProducts();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(res.message).toBe('Products seeded successfully');
    });
  });

  describe('updateProduct (upsert units by barcode)', () => {
    it('updates an existing unit in place without wiping all units', async () => {
      const existingUnit = {
        id: 10,
        barcode: '8850001',
        unitName: UnitName.BOTTLE,
        multiplier: 1,
        retailPrice: 15,
        wholesalePrice: 14,
        published: true,
      };
      const product = { id: 1, units: [existingUnit] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '8850001',
            unitName: UnitName.BOTTLE,
            multiplier: 1,
            retailPrice: 16,
            wholesalePrice: 15,
          },
        ],
      });

      // Same object mutated and saved — id preserved
      expect(existingUnit.retailPrice).toBe(16);
      expect(existingUnit.wholesalePrice).toBe(15);
      expect(existingUnit.id).toBe(10);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(existingUnit);
      // Must NOT do the old wipe-and-recreate
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
      // No new unit created for an existing barcode
      expect(unitRepo.create).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('creates a new unit when the barcode does not exist yet', async () => {
      const product = { id: 1, units: [] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '9990000',
            unitName: UnitName.PACK,
            multiplier: 6,
            retailPrice: 85,
            wholesalePrice: 80,
          },
        ],
      });

      expect(unitRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ product, barcode: '9990000', multiplier: 6 }),
      );
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
    });

    it('re-publishes a previously soft-deleted unit when its barcode is resent', async () => {
      const softDeleted = {
        id: 5,
        barcode: '8850001',
        unitName: UnitName.BOTTLE,
        multiplier: 1,
        retailPrice: 15,
        wholesalePrice: 14,
        published: false,
      };
      const product = { id: 1, units: [softDeleted] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '8850001',
            unitName: UnitName.BOTTLE,
            multiplier: 1,
            retailPrice: 15,
            wholesalePrice: 14,
          },
        ],
      });

      expect(softDeleted.published).toBe(true);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(softDeleted);
    });

    it('does not touch units when dto.units is omitted', async () => {
      const product = { id: 1, units: [{ id: 1, barcode: '8850001' }] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, { name: 'New name' });

      expect(unitRepo.create).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
      // Only the product entity itself is saved
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProductUnitById', () => {
    it('returns a published unit by id', async () => {
      const unit = { id: 10, barcode: '8850001', published: true };
      unitRepo.findOne.mockResolvedValueOnce(unit);

      const res = await service.getProductUnitById(10);

      expect(unitRepo.findOne).toHaveBeenCalledWith({
        where: { id: 10, published: true },
        relations: { product: true },
      });
      expect(res).toBe(unit);
    });

    it('throws when the unit is not found', async () => {
      unitRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getProductUnitById(999)).rejects.toThrow(
        'Product unit not found',
      );
    });
  });

  describe('createProductUnit', () => {
    it('creates a unit under an existing product', async () => {
      const product = { id: 1 };
      const created = { id: 20, barcode: '9990000', published: true };
      productRepo.findOne.mockResolvedValueOnce(product);
      unitRepo.save.mockResolvedValueOnce({ id: 20 });
      // getProductUnitById call after save
      unitRepo.findOne.mockResolvedValueOnce(created);

      const res = await service.createProductUnit({
        productId: 1,
        barcode: '9990000',
        unitName: UnitName.PACK,
        multiplier: 6,
        retailPrice: 85,
        wholesalePrice: 80,
      });

      expect(productRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(unitRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ product, barcode: '9990000', multiplier: 6 }),
      );
      expect(unitRepo.save).toHaveBeenCalled();
      expect(res).toBe(created);
    });

    it('throws when the product does not exist', async () => {
      productRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createProductUnit({
          productId: 999,
          barcode: '9990000',
          unitName: UnitName.PACK,
          multiplier: 6,
          retailPrice: 85,
          wholesalePrice: 80,
        }),
      ).rejects.toThrow('Product not found');
      expect(unitRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateProductUnit', () => {
    it('updates only the provided fields', async () => {
      const unit = {
        id: 10,
        barcode: '8850001',
        unitName: UnitName.BOTTLE,
        multiplier: 1,
        retailPrice: 15,
        wholesalePrice: 14,
        published: true,
      };
      unitRepo.findOne.mockResolvedValueOnce(unit);

      const res = await service.updateProductUnit(10, { retailPrice: 16 });

      expect(unit.retailPrice).toBe(16);
      expect(unit.wholesalePrice).toBe(14);
      expect(unitRepo.save).toHaveBeenCalledWith(unit);
      expect(res).toBe(unit);
    });

    it('throws when the unit is not found', async () => {
      unitRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateProductUnit(999, { retailPrice: 16 }),
      ).rejects.toThrow('Product unit not found');
      expect(unitRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteProductUnit', () => {
    it('soft deletes a unit by id', async () => {
      const unit = { id: 10, barcode: '8850001', published: true };
      unitRepo.findOne.mockResolvedValueOnce(unit);

      const res = await service.deleteProductUnit(10);

      expect(unit.published).toBe(false);
      expect(unitRepo.save).toHaveBeenCalledWith(unit);
      expect(res.message).toBe('Product unit 10 has been deleted');
    });

    it('throws when the id is not found', async () => {
      unitRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteProductUnit(999)).rejects.toThrow(
        'Product unit not found',
      );
      expect(unitRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Category', () => {
    it('getAllCategories should return array', async () => {
      categoryRepo.find.mockResolvedValueOnce([{ id: 1, name: 'Cat' }]);
      const res = await service.getAllCategories();
      expect(categoryRepo.find).toHaveBeenCalled();
      expect(res).toEqual([{ id: 1, name: 'Cat' }]);
    });

    it('getCategoryById should return category if found', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ id: 1, name: 'Cat' });
      const res = await service.getCategoryById(1);
      expect(categoryRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toEqual({ id: 1, name: 'Cat' });
    });

    it('getCategoryById should throw if not found', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getCategoryById(99)).rejects.toThrow(
        'Category not found',
      );
    });

    it('createCategory should create and return category', async () => {
      categoryRepo.create.mockReturnValue({ name: 'Cat' });
      categoryRepo.save.mockImplementation((obj: any) => {
        obj.id = 1;
        return Promise.resolve(obj);
      });
      const res = await service.createCategory({ name: 'Cat' });
      expect(res).toEqual({ id: 1, name: 'Cat' });
    });

    it('updateCategory should update and return category', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ id: 1, name: 'Old' });
      const res = await service.updateCategory(1, { name: 'New' });
      expect(categoryRepo.save).toHaveBeenCalledWith({ id: 1, name: 'New' });
      expect(res).toEqual({ id: 1, name: 'New' });
    });

    it('deleteCategory should remove category if no products', async () => {
      const category = { id: 1, name: 'Cat', products: [] };
      categoryRepo.findOne.mockResolvedValueOnce(category);
      const res = await service.deleteCategory(1);
      expect(categoryRepo.remove).toHaveBeenCalledWith(category);
      expect(res).toEqual({ message: 'Category 1 has been deleted' });
    });

    it('deleteCategory should throw if category has products', async () => {
      const category = { id: 1, name: 'Cat', products: [{ id: 10 }] };
      categoryRepo.findOne.mockResolvedValueOnce(category);
      await expect(service.deleteCategory(1)).rejects.toThrow(
        'Cannot delete category with products',
      );
    });
  });

  describe('Supplier', () => {
    it('getAllSuppliers should return array', async () => {
      supplierRepo.find.mockResolvedValueOnce([{ id: 1, name: 'Supplier A' }]);
      const res = await service.getAllSuppliers();
      expect(supplierRepo.find).toHaveBeenCalled();
      expect(res).toEqual([{ id: 1, name: 'Supplier A' }]);
    });

    it('getSupplierById should return supplier if found', async () => {
      supplierRepo.findOne.mockResolvedValueOnce({ id: 1, name: 'Supplier A' });
      const res = await service.getSupplierById(1);
      expect(supplierRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toEqual({ id: 1, name: 'Supplier A' });
    });

    it('getSupplierById should throw if not found', async () => {
      supplierRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getSupplierById(99)).rejects.toThrow(
        'Supplier not found',
      );
    });

    it('createSupplier should create and return supplier', async () => {
      supplierRepo.create.mockReturnValue({ name: 'Supplier A' });
      supplierRepo.save.mockImplementation((obj: any) => {
        obj.id = 1;
        return Promise.resolve(obj);
      });
      const res = await service.createSupplier({ name: 'Supplier A' });
      expect(res).toEqual({ id: 1, name: 'Supplier A' });
    });

    it('updateSupplier should update and return supplier', async () => {
      supplierRepo.findOne.mockResolvedValueOnce({ id: 1, name: 'Old' });
      const res = await service.updateSupplier(1, { name: 'New' });
      expect(supplierRepo.save).toHaveBeenCalledWith({ id: 1, name: 'New' });
      expect(res).toEqual({ id: 1, name: 'New' });
    });

    it('deleteSupplier should remove supplier', async () => {
      const supplier = { id: 1, name: 'Supplier A' };
      supplierRepo.findOne.mockResolvedValueOnce(supplier);
      const res = await service.deleteSupplier(1);
      expect(supplierRepo.remove).toHaveBeenCalledWith(supplier);
      expect(res).toEqual({ message: 'Supplier 1 has been deleted' });
    });
  });

  describe('Purchase Order', () => {
    it('createPurchaseOrder should create PO and receive goods', async () => {
      const dto = { items: [{ barcode: '123', qty: 2 }] };
      const mockProduct = { id: 1, name: 'Prod', costPrice: 10 };
      const mockUnit = {
        id: 1,
        barcode: '123',
        multiplier: 2,
        product: mockProduct,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockUnit) // for unit
        .mockResolvedValueOnce(null); // for inventory (new)

      const res = await service.createPurchaseOrder(dto);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled(); // saving PO, transaction, inventory, etc.
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(res.message).toEqual('Purchase order created successfully');
      expect(res.poNo).toBeDefined();
    });

    it('createPurchaseOrder should rollback and throw on error', async () => {
      const dto = { items: [{ barcode: '123', qty: 2 }] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null); // barcode not found

      await expect(service.createPurchaseOrder(dto)).rejects.toThrow(
        'Barcode 123 not found',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
