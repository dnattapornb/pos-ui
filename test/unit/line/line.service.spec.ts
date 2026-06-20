import { Test, TestingModule } from '@nestjs/testing';
import { LineService } from '../../../src/line/line.service';
import { OcrService } from '../../../src/ocr/ocr.service';
import { ReceiptService } from '../../../src/receipt/receipt.service';
import { ConfigService } from '@nestjs/config';
import { messagingApi } from '@line/bot-sdk';
import * as FlexBuilder from '../../../src/line/flex.builder';

jest.mock('@line/bot-sdk', () => ({
    messagingApi: {
        MessagingApiClient: jest.fn().mockImplementation(() => ({
            replyMessage: jest.fn(),
            pushMessage: jest.fn(),
        })),
        MessagingApiBlobClient: jest.fn().mockImplementation(() => ({
            getMessageContent: jest.fn(),
        })),
    },
}));

describe('LineService', () => {
    let service: LineService;
    let mockOcrService: any;
    let mockReceiptService: any;
    let mockLineClient: any;
    let mockBlobClient: any;

    beforeEach(async () => {
        mockOcrService = {
            processReceipt: jest.fn(),
        };

        mockReceiptService = {
            createReceipt: jest.fn(),
            getReceiptById: jest.fn(),
            approveReceipt: jest.fn(),
            cancelReceipt: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LineService,
                { provide: OcrService, useValue: mockOcrService },
                { provide: ReceiptService, useValue: mockReceiptService },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('dummy-token'),
                    },
                },
            ],
        }).compile();

        service = module.get<LineService>(LineService);
        mockLineClient = (service as any).lineClient;
        mockBlobClient = (service as any).lineBlobClient;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleWebhook', () => {
        it('should route image messages to handleImageMessage', async () => {
            const spy = jest.spyOn(service as any, 'handleImageMessage').mockResolvedValue(undefined);
            const events = [{ type: 'message', message: { type: 'image' } }] as any;
            await service.handleWebhook(events);
            expect(spy).toHaveBeenCalledWith(events[0]);
        });

        it('should route postback to handlePostback', async () => {
            const spy = jest.spyOn(service as any, 'handlePostback').mockResolvedValue(undefined);
            const events = [{ type: 'postback' }] as any;
            await service.handleWebhook(events);
            expect(spy).toHaveBeenCalledWith(events[0]);
        });
    });

    describe('handleImageMessage', () => {
        it('should reject unauthorized users', async () => {
            const spy = jest.spyOn(service as any, 'safeReplyText').mockResolvedValue(undefined);
            const event = { source: { userId: 'unauthorized-user' }, message: { id: 'msg1' }, replyToken: 'rt1' };
            await (service as any).handleImageMessage(event);
            expect(spy).toHaveBeenCalledWith('rt1', 'ขออภัย คุณไม่มีสิทธิ์ใช้งานบอทนี้');
            expect(mockBlobClient.getMessageContent).not.toHaveBeenCalled();
        });

        it('should process authorized user image, run OCR, save DB, and reply Flex', async () => {
            const event = { source: { userId: 'Uf327dc13da3f951e3a0ef8176d0bf7ba' }, message: { id: 'msg1' }, replyToken: 'rt1' };
            const mockStream = [Buffer.from('chunk1')];
            mockBlobClient.getMessageContent.mockResolvedValue(mockStream);
            
            mockOcrService.processReceipt.mockResolvedValue({ storeName: 'Test' });
            mockReceiptService.createReceipt.mockResolvedValue({ receiptId: 'rcpt_123' });
            
            jest.spyOn(FlexBuilder, 'buildReceiptFlexMessage').mockReturnValue({ type: 'flex', altText: 'Test' } as any);

            await (service as any).handleImageMessage(event);

            expect(mockOcrService.processReceipt).toHaveBeenCalledWith(Buffer.from('chunk1'));
            expect(mockReceiptService.createReceipt).toHaveBeenCalledWith('Uf327dc13da3f951e3a0ef8176d0bf7ba', { storeName: 'Test' });
            expect(mockLineClient.replyMessage).toHaveBeenCalled();
        });
    });

    describe('handlePostback', () => {
        it('should reply error if receipt not pending', async () => {
            const spy = jest.spyOn(service as any, 'safeReplyText').mockResolvedValue(undefined);
            mockReceiptService.getReceiptById.mockResolvedValue({ status: 'approved' });
            
            const event = { postback: { data: 'action=approve&id=rcpt_123' }, replyToken: 'rt1' };
            await (service as any).handlePostback(event);
            
            expect(spy).toHaveBeenCalledWith('rt1', expect.stringContaining('อนุมัติไปแล้ว'));
        });

        it('should approve receipt and send final flex message', async () => {
            mockReceiptService.getReceiptById.mockResolvedValue({ status: 'pending' });
            mockReceiptService.approveReceipt.mockResolvedValue({ status: 'approved' });
            jest.spyOn(FlexBuilder, 'buildFinalReceiptFlexMessage').mockReturnValue({ type: 'flex', altText: 'Approved' } as any);
            
            const event = { postback: { data: 'action=approve&id=rcpt_123' }, replyToken: 'rt1' };
            await (service as any).handlePostback(event);
            
            expect(mockReceiptService.approveReceipt).toHaveBeenCalledWith('rcpt_123');
            expect(mockLineClient.replyMessage).toHaveBeenCalled();
        });

        it('should cancel receipt and send final flex message', async () => {
            mockReceiptService.getReceiptById.mockResolvedValue({ status: 'pending' });
            mockReceiptService.cancelReceipt.mockResolvedValue({ status: 'cancelled' });
            jest.spyOn(FlexBuilder, 'buildFinalReceiptFlexMessage').mockReturnValue({ type: 'flex', altText: 'Cancelled' } as any);
            
            const event = { postback: { data: 'action=cancel&id=rcpt_123' }, replyToken: 'rt1' };
            await (service as any).handlePostback(event);
            
            expect(mockReceiptService.cancelReceipt).toHaveBeenCalledWith('rcpt_123');
            expect(mockLineClient.replyMessage).toHaveBeenCalled();
        });
    });

    describe('safeReplyText', () => {
        it('should send text and handle error gracefully', async () => {
            mockLineClient.replyMessage.mockRejectedValue(new Error('Network error'));
            await expect((service as any).safeReplyText('rt1', 'msg')).resolves.not.toThrow();
        });
    });
});
