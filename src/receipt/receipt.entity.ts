import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ReceiptItem } from './receipt-item.entity';

export enum ReceiptStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    CANCELLED = 'cancelled',
}

@Entity('receipt')
export class Receipt {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'user_id' })
    userId!: string;

    @Column({ name: 'store_name' })
    storeName!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    date!: string | null;

    @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0.00 })
    totalAmount!: number;

    @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.PENDING })
    status!: ReceiptStatus;

    @OneToMany(() => ReceiptItem, (item) => item.receipt, { cascade: true, eager: true })
    items!: ReceiptItem[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
