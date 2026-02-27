import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReceiptDocument = HydratedDocument<Receipt>;

@Schema()
export class ReceiptItem {
    @Prop({ required: true })
    name!: string;

    @Prop({ required: true })
    quantity!: number;

    @Prop({ required: true })
    price!: number;
}

@Schema({ timestamps: true })
export class Receipt {
    @Prop({ required: true, unique: true, index: true })
    receiptId!: string;

    @Prop({ required: true })
    userId!: string;

    @Prop({ required: true })
    storeName!: string;

    @Prop({ type: String, default: null })
    date!: string | null;

    @Prop({ required: true })
    totalAmount!: number;

    @Prop({ type: [{ name: String, quantity: Number, price: Number }], default: [] })
    items!: ReceiptItem[];

    @Prop({ default: 'pending' })
    status!: string;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);
