import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CheckoutDto,
  CreateProductDto,
  CreatePurchaseOrderDto,
  UpdateProductDto,
} from '../../../../src/pos/dto/pos.dto';
import { UnitName } from '../../../../src/pos/enums/unit.enum';

const validUnit = {
  barcode: '8850001',
  unitName: UnitName.BOTTLE,
  multiplier: 1,
  retailPrice: 15,
  wholesalePrice: 14,
};

describe('POS DTO validation', () => {
  describe('CreateProductDto', () => {
    it('passes with a valid payload', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: 'SKU-001',
        name: 'น้ำอัดลม 325 มล.',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 12,
        units: [validUnit],
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('fails when required string fields are empty', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: '',
        name: '',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 12,
        units: [validUnit],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toEqual(
        expect.arrayContaining(['sku', 'name']),
      );
    });

    it('fails when baseUnitName is not a valid enum value', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: 'SKU-001',
        name: 'test',
        baseUnitName: 'INVALID_UNIT',
        costPrice: 12,
        units: [validUnit],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('baseUnitName');
    });

    it('fails when costPrice is negative', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: 'SKU-001',
        name: 'test',
        baseUnitName: UnitName.BOTTLE,
        costPrice: -5,
        units: [validUnit],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('costPrice');
    });

    it('fails when units array is empty', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: 'SKU-001',
        name: 'test',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 12,
        units: [],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('units');
    });

    it('fails when a nested unit is invalid', () => {
      const dto = plainToInstance(CreateProductDto, {
        sku: 'SKU-001',
        name: 'test',
        baseUnitName: UnitName.BOTTLE,
        costPrice: 12,
        units: [{ ...validUnit, multiplier: 0, barcode: '' }],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('units');
    });
  });

  describe('UpdateProductDto', () => {
    it('passes with an empty payload (all optional)', () => {
      const dto = plainToInstance(UpdateProductDto, {});
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('passes with a partial valid payload', () => {
      const dto = plainToInstance(UpdateProductDto, {
        name: 'updated',
        published: false,
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('fails when published is not a boolean', () => {
      const dto = plainToInstance(UpdateProductDto, { published: 'yes' });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('published');
    });
  });

  describe('CreatePurchaseOrderDto', () => {
    it('passes with a valid payload', () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        supplierId: 1,
        items: [{ barcode: '8850001', qty: 5 }],
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('fails when items array is empty', () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        supplierId: 1,
        items: [],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('items');
    });

    it('fails when item qty is not positive', () => {
      const dto = plainToInstance(CreatePurchaseOrderDto, {
        items: [{ barcode: '8850001', qty: 0 }],
      });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('items');
    });
  });

  describe('CheckoutDto', () => {
    it('passes with a valid payload', () => {
      const dto = plainToInstance(CheckoutDto, {
        items: [{ barcode: '8850001', qty: 2 }],
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('fails when items array is empty', () => {
      const dto = plainToInstance(CheckoutDto, { items: [] });
      const errors = validateSync(dto);
      expect(errors.map((e) => e.property)).toContain('items');
    });
  });
});
