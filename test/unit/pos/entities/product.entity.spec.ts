import { Product } from '../../../../src/pos/entities/product.entity';
import { UnitName } from '../../../../src/pos/enums/unit.enum';

/**
 * Timezone policy guard (task 2026.06.20.002):
 * `created_at` / `updated_at` are stored and returned as UTC. When an entity is
 * serialized to JSON (as NestJS does for responses), the Date columns must emit
 * ISO 8601 UTC strings ending in `Z` with NO local (+07) offset applied.
 */
describe('Product entity timezone serialization', () => {
  const buildProduct = (createdAt: Date, updatedAt: Date): Product => {
    const product = new Product();
    product.id = 1;
    product.sku = 'SKU-001';
    product.name = 'น้ำอัดลม 325 มล.';
    product.baseUnitName = UnitName.BOTTLE;
    product.costPrice = 12;
    product.published = true;
    product.createdAt = createdAt;
    product.updatedAt = updatedAt;
    return product;
  };

  it('serializes createdAt / updatedAt as UTC ISO 8601 strings (no offset)', () => {
    // A known UTC instant: 2026-06-20T07:00:00.000Z
    const instant = new Date(Date.UTC(2026, 5, 20, 7, 0, 0, 0));
    const product = buildProduct(instant, instant);

    const serialized = JSON.parse(JSON.stringify(product)) as {
      createdAt: string;
      updatedAt: string;
    };

    expect(serialized.createdAt).toBe('2026-06-20T07:00:00.000Z');
    expect(serialized.updatedAt).toBe('2026-06-20T07:00:00.000Z');
  });

  it('always ends with Z and applies no Asia/Bangkok (+07) skew', () => {
    const instant = new Date(Date.UTC(2026, 5, 20, 23, 30, 0, 0));
    const product = buildProduct(instant, instant);

    const { createdAt } = JSON.parse(JSON.stringify(product)) as {
      createdAt: string;
    };

    expect(createdAt.endsWith('Z')).toBe(true);
    // The serialized value must equal the raw UTC instant, not +07 (which would
    // wrongly roll over to the next day at 06:30).
    expect(createdAt).toBe(instant.toISOString());
    expect(createdAt).not.toBe('2026-06-21T06:30:00.000Z');
  });
});
