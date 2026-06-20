import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt, ReceiptStatus } from './receipt.entity';
import { ReceiptItem } from './receipt-item.entity';
import { ReceiptData } from '../ocr/receipt.interface';

@Injectable()
export class ReceiptService {
    private readonly logger = new Logger(ReceiptService.name);

    constructor(
        @InjectRepository(Receipt)
        private readonly receiptRepository: Repository<Receipt>,
        @InjectRepository(ReceiptItem)
        private readonly receiptItemRepository: Repository<ReceiptItem>,
    ) { }

    async createReceipt(userId: string, data: ReceiptData): Promise<Receipt> {
        const receipt = this.receiptRepository.create({
            userId,
            storeName: data.storeName,
            date: data.date,
            totalAmount: data.totalAmount,
            status: ReceiptStatus.PENDING,
            items: data.items.map(item => this.receiptItemRepository.create({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
        });

        const saved = await this.receiptRepository.save(receipt);
        this.logger.log(`Receipt created in DB: ${saved.id} for userId: ${userId}`);
        return saved;
    }

    async getReceiptById(id: string): Promise<Receipt> {
        const doc = await this.receiptRepository.findOne({ where: { id } });
        if (!doc) {
            throw new NotFoundException(`Receipt with id "${id}" not found`);
        }
        return doc;
    }

    async updateReceipt(id: string, updateData: Partial<ReceiptData>): Promise<Receipt> {
        const doc = await this.getReceiptById(id);
        
        if (updateData.storeName !== undefined) doc.storeName = updateData.storeName;
        if (updateData.date !== undefined) doc.date = updateData.date;
        if (updateData.totalAmount !== undefined) doc.totalAmount = updateData.totalAmount;
        
        if (updateData.items) {
            // Overwrite items
            await this.receiptItemRepository.delete({ receipt: { id } });
            doc.items = updateData.items.map(item => this.receiptItemRepository.create({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            }));
        }

        const saved = await this.receiptRepository.save(doc);
        this.logger.log(`Receipt updated: ${id}`);
        return saved;
    }

    async approveReceipt(id: string): Promise<Receipt> {
        const doc = await this.getReceiptById(id);
        doc.status = ReceiptStatus.APPROVED;
        const saved = await this.receiptRepository.save(doc);
        this.logger.log(`Receipt approved: ${id}`);
        return saved;
    }

    async cancelReceipt(id: string): Promise<Receipt> {
        const doc = await this.getReceiptById(id);
        doc.status = ReceiptStatus.CANCELLED;
        const saved = await this.receiptRepository.save(doc);
        this.logger.log(`Receipt cancelled: ${id}`);
        return saved;
    }
}
