import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, WebhookEvent } from '@line/bot-sdk';
import { OcrService } from '../ocr/ocr.service';
import { ReceiptService } from '../receipt/receipt.service';
import { buildReceiptFlexMessage, buildFinalReceiptFlexMessage } from './flex.builder';
import { ReceiptData } from '../ocr/receipt.interface';

const { MessagingApiClient, MessagingApiBlobClient } = messagingApi;

@Injectable()
export class LineService {
    private readonly logger = new Logger(LineService.name);
    private readonly lineClient: messagingApi.MessagingApiClient;
    private readonly lineBlobClient: messagingApi.MessagingApiBlobClient;

    constructor(
        private readonly configService: ConfigService,
        private readonly ocrService: OcrService,
        private readonly receiptService: ReceiptService,
    ) {
        const channelAccessToken =
            this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN')?.trim() ?? '';
        this.lineClient = new MessagingApiClient({ channelAccessToken });
        this.lineBlobClient = new MessagingApiBlobClient({ channelAccessToken });
    }

    async handleWebhook(events: WebhookEvent[]): Promise<void> {
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'image') {
                await this.handleImageMessage(event);
            } else if (event.type === 'postback') {
                await this.handlePostback(event);
            } else {
                this.logger.debug(
                    `Ignored event type: ${event.type} / message type: ${(event as any).message?.type}`,
                );
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Handle incoming image: OCR → Gemini → Save to DB → Flex Message reply
    // ─────────────────────────────────────────────────────────
    private async handleImageMessage(event: any): Promise<void> {
        const userId: string = event.source?.userId ?? 'unknown';
        this.logger.log(`Processing image. msgId: ${event.message.id}, userId: ${userId}`);

        // 0. Filter by allowed userId
        const allowedUserId = 'Uf327dc13da3f951e3a0ef8176d0bf7ba';
        if (userId !== allowedUserId) {
            this.logger.warn(`Unauthorized user: ${userId}`);
            await this.safeReplyText(event.replyToken, 'ขออภัย คุณไม่มีสิทธิ์ใช้งานบอทนี้');
            return;
        }

        try {
            // 1. Download image
            const stream = (await this.lineBlobClient.getMessageContent(event.message.id)) as any;
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk as Buffer);
            }
            const imageBuffer = Buffer.concat(chunks);
            this.logger.log(`Image downloaded: ${imageBuffer.length} bytes`);

            // 2. OCR → Gemini structured parse
            this.logger.log('Starting processReceipt pipeline...');
            const receiptData = await this.ocrService.processReceipt(imageBuffer);

            // 3. Persist to MongoDB BEFORE sending Flex Message
            const savedReceipt = await this.receiptService.createReceipt(userId, receiptData);
            const receiptId = savedReceipt.receiptId;
            this.logger.log(`Receipt persisted to DB: ${receiptId}`);

            // 4. Build Flex Message and reply
            const flexMessage = buildReceiptFlexMessage(receiptData, receiptId);

            if (event.replyToken) {
                await this.lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [flexMessage],
                });
                this.logger.log(`Flex message sent to userId: ${userId}, receiptId: ${receiptId}`);
            }
        } catch (error: any) {
            this.logger.error(`Error processing image: ${error.message}`, error.stack);
            await this.safeReplyText(
                event.replyToken,
                'ขออภัย ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Handle Postback: action=approve&id=<receiptId>
    // ─────────────────────────────────────────────────────────
    private async handlePostback(event: any): Promise<void> {
        const data: string = event.postback?.data ?? '';
        const params = new URLSearchParams(data);
        const action = params.get('action');
        const receiptId = params.get('id');

        const liffEditUrl = process.env.LIFF_EDIT_URL ?? 'https://liff.line.me/your-liff-id';
        this.logger.log(`[POSTBACK] raw data string: "${data}"`);
        this.logger.log(`[POSTBACK] action="${action}", receiptId="${receiptId}"`);
        this.logger.log(`[POSTBACK] LIFF_EDIT_URL from env: "${liffEditUrl}"`);
        this.logger.log(`[POSTBACK] Full edit URL would be: "${liffEditUrl}?id=${receiptId}"`);

        if (!receiptId) return;

        // Check if receipt is already processed
        try {
            const receipt = await this.receiptService.getReceiptById(receiptId);
            if (receipt.status !== 'pending') {
                const statusTh = receipt.status === 'approved' ? 'อนุมัติ' : 'ยกเลิก';
                await this.safeReplyText(
                    event.replyToken,
                    `ไม่สามารถทำรายการได้ เนื่องจากใบเสร็จนี้ได้ทำการ${statusTh}ไปแล้ว`,
                );
                return;
            }
        } catch (err) {
            this.logger.error(`Receipt not found or db error: ${err}`);
            await this.safeReplyText(event.replyToken, 'ไม่พบข้อมูลใบเสร็จในระบบ');
            return;
        }

        if (action === 'approve') {
            try {
                const doc = await this.receiptService.approveReceipt(receiptId);
                const receiptData: ReceiptData = {
                    storeName: doc.storeName,
                    date: doc.date,
                    totalAmount: doc.totalAmount,
                    items: doc.items,
                    status: doc.status,
                };
                const flexMessage = buildFinalReceiptFlexMessage(receiptData, doc.status ?? 'approved');

                await this.lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [flexMessage],
                });
            } catch (err: any) {
                this.logger.error(`Failed to approve receipt ${receiptId}: ${err.message}`);
                await this.safeReplyText(event.replyToken, 'ขออภัย ไม่สามารถอัปเดตสถานะได้');
            }
        } else if (action === 'cancel') {
            try {
                const doc = await this.receiptService.cancelReceipt(receiptId);
                const receiptData: ReceiptData = {
                    storeName: doc.storeName,
                    date: doc.date,
                    totalAmount: doc.totalAmount,
                    items: doc.items,
                    status: doc.status,
                };
                const flexMessage = buildFinalReceiptFlexMessage(receiptData, doc.status ?? 'cancelled');

                await this.lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [flexMessage],
                });
            } catch (err: any) {
                this.logger.error(`Failed to cancel receipt ${receiptId}: ${err.message}`);
                await this.safeReplyText(event.replyToken, 'ขออภัย ไม่สามารถยกเลิกใบเสร็จได้');
            }
        } else {
            this.logger.warn(`Unknown postback action: ${action}`);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Utility: send a plain text reply without crashing the bot
    // ─────────────────────────────────────────────────────────
    private async safeReplyText(replyToken: string | undefined, text: string): Promise<void> {
        if (!replyToken) return;
        try {
            await this.lineClient.replyMessage({
                replyToken,
                messages: [{ type: 'text', text }],
            });
        } catch (e: any) {
            this.logger.error(`Failed to send text reply: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Push the final receipt flex message to the user
    // ─────────────────────────────────────────────────────────
    async sendFinalReceiptMessage(userId: string, receiptData: ReceiptData, status: string): Promise<void> {
        try {
            const flexMessage = buildFinalReceiptFlexMessage(receiptData, status);
            await this.lineClient.pushMessage({
                to: userId,
                messages: [flexMessage],
            });
            this.logger.log(`Final flex message sent to userId: ${userId} with status: ${status}`);
        } catch (error: any) {
            this.logger.error(`Failed to push final receipt message to ${userId}: ${error.message}`);
        }
    }
}
