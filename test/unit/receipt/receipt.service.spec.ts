import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReceiptService } from '../../../src/receipt/receipt.service';
import { Receipt, ReceiptStatus } from '../../../src/receipt/receipt.entity';
import { ReceiptItem } from '../../../src/receipt/receipt-item.entity';

describe('ReceiptService', () => {
    let service: ReceiptService;
    let mockReceiptRepo: Partial<Record<keyof Repository<Receipt>, jest.Mock>>;
    let mockItemRepo: Partial<Record<keyof Repository<ReceiptItem>, jest.Mock>>;

    beforeEach(async () => {
        mockReceiptRepo = {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: 'rcpt-123' })),
            findOne: jest.fn(),
        };

        mockItemRepo = {
            create: jest.fn().mockImplementation((dto) => dto),
            delete: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReceiptService,
                { provide: getRepositoryToken(Receipt), useValue: mockReceiptRepo },
                { provide: getRepositoryToken(ReceiptItem), useValue: mockItemRepo },
            ],
        }).compile();

        service = module.get<ReceiptService>(ReceiptService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createReceipt', () => {
        it('should create a new receipt with pending status', async () => {
            const result = await service.createReceipt('user-1', {
                storeName: 'Test Store',
                date: '01/01/2026',
                totalAmount: 100,
                items: [{ name: 'Item 1', quantity: 1, price: 100 }]
            });

            expect(mockReceiptRepo.create).toHaveBeenCalled();
            expect(mockItemRepo.create).toHaveBeenCalled();
            expect(mockReceiptRepo.save).toHaveBeenCalled();
            expect(result.id).toBe('rcpt-123');
            expect(result.status).toBe(ReceiptStatus.PENDING);
        });
    });

    describe('getReceiptById', () => {
        it('should return receipt if found', async () => {
            const receipt = { id: 'rcpt-123', status: ReceiptStatus.PENDING };
            mockReceiptRepo.findOne?.mockResolvedValue(receipt);

            const result = await service.getReceiptById('rcpt-123');
            expect(result).toEqual(receipt);
        });

        it('should throw NotFoundException if not found', async () => {
            mockReceiptRepo.findOne?.mockResolvedValue(null);
            await expect(service.getReceiptById('invalid')).rejects.toThrow(NotFoundException);
        });
    });

    describe('approveReceipt', () => {
        it('should update status to approved', async () => {
            const receipt = { id: 'rcpt-123', status: ReceiptStatus.PENDING };
            mockReceiptRepo.findOne?.mockResolvedValue(receipt);

            await service.approveReceipt('rcpt-123');

            expect(mockReceiptRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: ReceiptStatus.APPROVED
            }));
        });
    });

    describe('cancelReceipt', () => {
        it('should update status to cancelled', async () => {
            const receipt = { id: 'rcpt-123', status: ReceiptStatus.PENDING };
            mockReceiptRepo.findOne?.mockResolvedValue(receipt);

            await service.cancelReceipt('rcpt-123');

            expect(mockReceiptRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: ReceiptStatus.CANCELLED
            }));
        });
    });
});
