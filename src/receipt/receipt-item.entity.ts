import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Receipt } from './receipt.entity';

@Entity('receipt_item')
export class ReceiptItem {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({ type: 'int', default: 1 })
    quantity!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
    price!: number;

    @ManyToOne(() => Receipt, (receipt) => receipt.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_id' })
    receipt!: Receipt;
}
