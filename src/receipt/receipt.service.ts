import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Receipt, ReceiptDocument } from './receipt.schema';
import { ReceiptData } from '../ocr/receipt.interface';

@Injectable()
export class ReceiptService {
    private readonly logger = new Logger(ReceiptService.name);

    constructor(
        @InjectModel(Receipt.name)
        private readonly receiptModel: Model<ReceiptDocument>,
    ) { }

    async createReceipt(userId: string, data: ReceiptData): Promise<ReceiptDocument> {
        const receiptId = `rcpt_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
        const created = new this.receiptModel({
            receiptId,
            userId,
            storeName: data.storeName,
            date: data.date,
            totalAmount: data.totalAmount,
            items: data.items,
            status: 'pending',
        });
        const saved = await created.save();
        this.logger.log(`Receipt created in DB: ${receiptId} for userId: ${userId}`);
        return saved;
    }

    async getReceiptById(receiptId: string): Promise<ReceiptDocument> {
        const doc = await this.receiptModel.findOne({ receiptId }).exec();
        if (!doc) {
            throw new NotFoundException(`Receipt with id "${receiptId}" not found`);
        }
        return doc;
    }

    async updateReceipt(receiptId: string, updateData: Partial<ReceiptData>): Promise<ReceiptDocument> {
        const doc = await this.receiptModel
            .findOneAndUpdate({ receiptId }, { $set: updateData }, { returnDocument: 'after' })
            .exec();
        if (!doc) {
            throw new NotFoundException(`Receipt with id "${receiptId}" not found`);
        }
        this.logger.log(`Receipt updated: ${receiptId}`);
        return doc;
    }

    async approveReceipt(receiptId: string): Promise<ReceiptDocument> {
        const result = await this.receiptModel
            .findOneAndUpdate({ receiptId }, { $set: { status: 'approved' } }, { returnDocument: 'after' })
            .exec();
        if (!result) {
            throw new NotFoundException(`Receipt with id "${receiptId}" not found`);
        }
        this.logger.log(`Receipt approved: ${receiptId}`);
        return result;
    }

    async cancelReceipt(receiptId: string): Promise<ReceiptDocument> {
        const result = await this.receiptModel
            .findOneAndUpdate({ receiptId }, { $set: { status: 'cancelled' } }, { returnDocument: 'after' })
            .exec();
        if (!result) {
            throw new NotFoundException(`Receipt with id "${receiptId}" not found`);
        }
        this.logger.log(`Receipt cancelled: ${receiptId}`);
        return result;
    }
}
