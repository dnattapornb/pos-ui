import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UnitName } from '../enums/unit.enum';
import { ProductUnit } from './product-unit.entity';
import { Inventory } from './inventory.entity';
import { Category } from './category.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ name: 'base_unit_name', type: 'enum', enum: UnitName })
  baseUnitName: UnitName;

  @Column('decimal', {
    name: 'cost_price',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costPrice: number;

  @OneToMany(() => ProductUnit, (unit) => unit.product, { cascade: true })
  units: ProductUnit[];

  @OneToOne(() => Inventory, (inventory) => inventory.product, {
    cascade: true,
  })
  inventory: Inventory;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ default: true })
  published: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
