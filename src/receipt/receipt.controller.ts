import { Body, Controller, Get, Logger, Param, Put, Inject, forwardRef } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { ReceiptData } from '../ocr/receipt.interface';
import { Receipt } from './receipt.entity';
import { LineService } from '../line/line.service';

@Controller('api/receipts')
export class ReceiptController {
    private readonly logger = new Logger(ReceiptController.name);

    constructor(
        private readonly receiptService: ReceiptService,
        @Inject(forwardRef(() => LineService))
        private readonly lineService: LineService,
    ) { }

    @Get(':id')
    async getReceipt(@Param('id') id: string): Promise<Receipt> {
        this.logger.log(`[GET /api/receipts/${id}] request received`);
        try {
            const doc = await this.receiptService.getReceiptById(id);
            this.logger.log(`[GET /api/receipts/${id}] found → storeName="${doc.storeName}", status="${doc.status}"`);
            return doc;
        } catch (err: any) {
            this.logger.error(`[GET /api/receipts/${id}] ERROR: ${err.message}`);
            throw err;
        }
    }

    @Put(':id')
    async updateReceipt(
        @Param('id') id: string,
        @Body() body: Partial<ReceiptData>,
    ): Promise<Receipt> {
        this.logger.log(`[PUT /api/receipts/${id}] body keys: ${Object.keys(body).join(', ')}`);
        try {
            const doc = await this.receiptService.updateReceipt(id, body);
            this.logger.log(`[PUT /api/receipts/${id}] updated OK`);

            // Check if status changed to approved or cancelled and trigger LINE flex message
            if (body.status === 'approved' || body.status === 'cancelled') {
                const receiptData: ReceiptData = {
                    storeName: doc.storeName,
                    date: doc.date,
                    totalAmount: doc.totalAmount,
                    items: doc.items,
                    status: doc.status,
                };
                await this.lineService.sendFinalReceiptMessage(doc.userId, receiptData, doc.status);
            }

            return doc;
        } catch (err: any) {
            this.logger.error(`[PUT /api/receipts/${id}] ERROR: ${err.message}`);
            throw err;
        }
    }
}
