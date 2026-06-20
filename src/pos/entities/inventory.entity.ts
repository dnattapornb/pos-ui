import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class Inventory {
  @PrimaryColumn({ name: 'product_id' })
  productId: number;

  @OneToOne(() => Product, (product) => product.inventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'qty_in_base_unit', type: 'int', default: 0 })
  qtyInBaseUnit: number;
}
