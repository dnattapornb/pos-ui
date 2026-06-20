import { Entity, Column, PrimaryGeneratedColumn, OneToMany, OneToOne } from 'typeorm';
import { RetailUnit } from '../enums/unit.enum';
import { ProductUnit } from './product-unit.entity';
import { Inventory } from './inventory.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ name: 'base_unit_name', type: 'enum', enum: RetailUnit })
  baseUnitName: RetailUnit;

  @Column('decimal', { name: 'cost_price', precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @OneToMany(() => ProductUnit, (unit) => unit.product, { cascade: true })
  units: ProductUnit[];

  @OneToOne(() => Inventory, (inventory) => inventory.product, { cascade: true })
  inventory: Inventory;
}
