import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';
import { RetailUnit } from '../enums/unit.enum';

@Entity()
export class ProductUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ unique: true })
  barcode: string;

  @Column({ name: 'unit_name', type: 'enum', enum: RetailUnit })
  unitName: RetailUnit;

  @Column()
  multiplier: number;

  @Column('decimal', { name: 'retail_price', precision: 10, scale: 2 })
  retailPrice: number;

  @Column('decimal', { name: 'wholesale_price', precision: 10, scale: 2 })
  wholesalePrice: number;
}
