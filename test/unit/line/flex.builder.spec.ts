import { buildReceiptFlexMessage, buildFinalReceiptFlexMessage } from '../../../src/line/flex.builder';
import { ReceiptData } from '../../../src/ocr/receipt.interface';

describe('Flex Builder', () => {
    const mockData: ReceiptData = {
        storeName: 'Cafe Amazon',
        date: '01/01/2026',
        totalAmount: 140.5,
        items: [
            { name: 'Latte', quantity: 1, price: 70 },
            { name: 'Mocha', quantity: 1, price: 70.5 },
        ],
    };

    describe('buildReceiptFlexMessage', () => {
        it('should build pending flex message with buttons', () => {
            const flex = buildReceiptFlexMessage(mockData, 'rcpt_123');
            
            expect(flex.type).toBe('flex');
            expect(flex.altText).toContain('Cafe Amazon');
            
            const bubble = flex.contents as any;
            expect(bubble.type).toBe('bubble');
            expect(bubble.header.contents[1].text).toBe('Cafe Amazon');
            
            // Should contain footer with 3 buttons
            expect(bubble.footer.contents.length).toBe(3);
            expect(bubble.footer.contents[0].action.data).toBe('action=approve&id=rcpt_123');
            expect(bubble.footer.contents[2].action.data).toBe('action=cancel&id=rcpt_123');
        });

        it('should handle empty items array', () => {
            const data: ReceiptData = { ...mockData, items: [] };
            const flex = buildReceiptFlexMessage(data, 'rcpt_123');
            const bubble = flex.contents as any;
            
            // Check that the fallback text is added
            const itemsBox = bubble.body.contents[3];
            expect(itemsBox.contents[0].text).toBe('ไม่พบรายการสินค้า');
        });
    });

    describe('buildFinalReceiptFlexMessage', () => {
        it('should build approved flex message without buttons', () => {
            const flex = buildFinalReceiptFlexMessage(mockData, 'approved');
            
            expect(flex.type).toBe('flex');
            
            const bubble = flex.contents as any;
            expect(bubble.footer).toBeUndefined(); // No buttons
            
            // Should have a green status box at the bottom
            const statusBox = bubble.body.contents[bubble.body.contents.length - 1];
            expect(statusBox.contents[0].text).toBe('อนุมัติเรียบร้อยแล้ว');
            expect(statusBox.contents[0].color).toBe('#27AE60');
        });

        it('should build cancelled flex message without buttons', () => {
            const flex = buildFinalReceiptFlexMessage(mockData, 'cancelled');
            
            const bubble = flex.contents as any;
            expect(bubble.footer).toBeUndefined(); // No buttons
            
            // Should have a red status box at the bottom
            const statusBox = bubble.body.contents[bubble.body.contents.length - 1];
            expect(statusBox.contents[0].text).toBe('ยกเลิกเรียบร้อยแล้ว');
            expect(statusBox.contents[0].color).toBe('#E74C3C');
        });
    });
});
