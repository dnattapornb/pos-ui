import { Test, TestingModule } from '@nestjs/testing';
import { PosController } from '../../../src/pos/pos.controller';
import { PosService } from '../../../src/pos/pos.service';
import {
  AddProductUnitDto,
  CreateProductDto,
} from '../../../src/pos/dto/pos.dto';
import { UnitName } from '../../../src/pos/enums/unit.enum';

type MockPosService = Record<keyof PosService, jest.Mock>;

describe('PosController', () => {
  let controller: PosController;
  let service: MockPosService;

  beforeEach(async () => {
    service = {
      getAllProducts: jest.fn().mockResolvedValue([]),
      getProductById: jest.fn().mockResolvedValue({ id: 1 }),
      createProduct: jest.fn().mockResolvedValue({ id: 1 }),
      updateProduct: jest.fn().mockResolvedValue({ id: 1 }),
      deleteProduct: jest.fn().mockResolvedValue({ message: 'Deleted' }),
      getProductUnitById: jest.fn().mockResolvedValue({ id: 1 }),
      createProductUnit: jest.fn().mockResolvedValue({ id: 1 }),
      updateProductUnit: jest.fn().mockResolvedValue({ id: 1 }),
      deleteProductUnit: jest
        .fn()
        .mockResolvedValue({ message: 'Unit deleted' }),
      seedProducts: jest.fn().mockResolvedValue({ message: 'Seeded' }),
      receiveGoods: jest.fn().mockResolvedValue({ message: 'Received' }),
      checkout: jest.fn().mockResolvedValue({ message: 'Checkout' }),
      getAllCategories: jest.fn().mockResolvedValue([]),
      getCategoryById: jest.fn().mockResolvedValue({ id: 1, name: 'Cat' }),
      createCategory: jest.fn().mockResolvedValue({ id: 1, name: 'Cat' }),
      updateCategory: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
      deleteCategory: jest.fn().mockResolvedValue({ message: 'Deleted' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosController],
      providers: [
        {
          provide: PosService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PosController>(PosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getAllProducts', async () => {
    const res = await controller.getAllProducts();
    expect(service.getAllProducts).toHaveBeenCalled();
    expect(res).toEqual([]);
  });

  it('should call getProductById', async () => {
    const res = await controller.getProductById(1);
    expect(service.getProductById).toHaveBeenCalledWith(1);
    expect(res).toEqual({ id: 1 });
  });

  it('should call createProduct', async () => {
    const dto: CreateProductDto = {
      sku: '123',
      name: 'Test product',
      baseUnitName: UnitName.BOTTLE,
      costPrice: 10,
      units: [
        {
          barcode: '8850001',
          unitName: UnitName.BOTTLE,
          multiplier: 1,
          retailPrice: 15,
          wholesalePrice: 14,
        },
      ],
    };
    const res = await controller.createProduct(dto);
    expect(service.createProduct).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: 1 });
  });

  it('should call updateProduct', async () => {
    const res = await controller.updateProduct(1, { name: 'test' });
    expect(service.updateProduct).toHaveBeenCalledWith(1, { name: 'test' });
    expect(res).toEqual({ id: 1 });
  });

  it('should call deleteProduct', async () => {
    const res = await controller.deleteProduct(1);
    expect(service.deleteProduct).toHaveBeenCalledWith(1);
    expect(res).toEqual({ message: 'Deleted' });
  });

  it('should call getProductUnitById', async () => {
    const res = await controller.getProductUnitById(1);
    expect(service.getProductUnitById).toHaveBeenCalledWith(1);
    expect(res).toEqual({ id: 1 });
  });

  it('should call createProductUnit', async () => {
    const dto: AddProductUnitDto = {
      productId: 1,
      barcode: '8850001',
      unitName: UnitName.BOTTLE,
      multiplier: 1,
      retailPrice: 15,
      wholesalePrice: 14,
    };
    const res = await controller.createProductUnit(dto);
    expect(service.createProductUnit).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: 1 });
  });

  it('should call updateProductUnit', async () => {
    const res = await controller.updateProductUnit(1, { retailPrice: 16 });
    expect(service.updateProductUnit).toHaveBeenCalledWith(1, {
      retailPrice: 16,
    });
    expect(res).toEqual({ id: 1 });
  });

  it('should call deleteProductUnit', async () => {
    const res = await controller.deleteProductUnit(1);
    expect(service.deleteProductUnit).toHaveBeenCalledWith(1);
    expect(res).toEqual({ message: 'Unit deleted' });
  });

  it('should call seedProducts', async () => {
    const res = await controller.seedProducts();
    expect(service.seedProducts).toHaveBeenCalled();
    expect(res).toEqual({ message: 'Seeded' });
  });

  it('should call receiveGoods', async () => {
    const dto = { barcode: '123', qty: 1 };
    const res = await controller.receiveGoods(dto);
    expect(service.receiveGoods).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: 'Received' });
  });

  it('should call checkout', async () => {
    const dto = { items: [{ barcode: '123', qty: 1 }] };
    const res = await controller.checkout(dto);
    expect(service.checkout).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: 'Checkout' });
  });

  it('should call getAllCategories', async () => {
    const res = await controller.getAllCategories();
    expect(service.getAllCategories).toHaveBeenCalled();
    expect(res).toEqual([]);
  });

  it('should call getCategoryById', async () => {
    const res = await controller.getCategoryById(1);
    expect(service.getCategoryById).toHaveBeenCalledWith(1);
    expect(res).toEqual({ id: 1, name: 'Cat' });
  });

  it('should call createCategory', async () => {
    const dto = { name: 'Cat' };
    const res = await controller.createCategory(dto);
    expect(service.createCategory).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: 1, name: 'Cat' });
  });

  it('should call updateCategory', async () => {
    const dto = { name: 'Updated' };
    const res = await controller.updateCategory(1, dto);
    expect(service.updateCategory).toHaveBeenCalledWith(1, dto);
    expect(res).toEqual({ id: 1, name: 'Updated' });
  });

  it('should call deleteCategory', async () => {
    const res = await controller.deleteCategory(1);
    expect(service.deleteCategory).toHaveBeenCalledWith(1);
    expect(res).toEqual({ message: 'Deleted' });
  });
});
