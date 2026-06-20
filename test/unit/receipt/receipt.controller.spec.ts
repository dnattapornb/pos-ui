import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptController } from '../../../src/receipt/receipt.controller';
import { ReceiptService } from '../../../src/receipt/receipt.service';
import { LineService } from '../../../src/line/line.service';
import { ReceiptStatus } from '../../../src/receipt/receipt.entity';

describe('ReceiptController', () => {
    let controller: ReceiptController;
    let mockReceiptService: any;
    let mockLineService: any;

    beforeEach(async () => {
        mockReceiptService = {
            getReceiptById: jest.fn(),
            updateReceipt: jest.fn(),
        };

        mockLineService = {
            sendFinalReceiptMessage: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReceiptController],
            providers: [
                { provide: ReceiptService, useValue: mockReceiptService },
                { provide: LineService, useValue: mockLineService },
            ],
        }).compile();

        controller = module.get<ReceiptController>(ReceiptController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getReceipt', () => {
        it('should return receipt by id', async () => {
            const mockDoc = { id: '123', storeName: 'Test', status: ReceiptStatus.PENDING };
            mockReceiptService.getReceiptById.mockResolvedValue(mockDoc);

            const result = await controller.getReceipt('123');
            expect(result).toEqual(mockDoc);
            expect(mockReceiptService.getReceiptById).toHaveBeenCalledWith('123');
        });
    });

    describe('updateReceipt', () => {
        it('should update receipt but not send line message if status is not final', async () => {
            const mockDoc = { id: '123', storeName: 'Updated', status: ReceiptStatus.PENDING };
            mockReceiptService.updateReceipt.mockResolvedValue(mockDoc);

            const result = await controller.updateReceipt('123', { storeName: 'Updated' });
            expect(result).toEqual(mockDoc);
            expect(mockLineService.sendFinalReceiptMessage).not.toHaveBeenCalled();
        });

        it('should update receipt and send line message if status is approved', async () => {
            const mockDoc = { id: '123', userId: 'user-1', storeName: 'Updated', status: ReceiptStatus.APPROVED, items: [], totalAmount: 100, date: null };
            mockReceiptService.updateReceipt.mockResolvedValue(mockDoc);

            await controller.updateReceipt('123', { status: ReceiptStatus.APPROVED });
            
            expect(mockLineService.sendFinalReceiptMessage).toHaveBeenCalledWith(
                'user-1',
                expect.objectContaining({ status: ReceiptStatus.APPROVED }),
                ReceiptStatus.APPROVED
            );
        });
    });
});
