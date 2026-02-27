import { messagingApi } from '@line/bot-sdk';
import { ReceiptData } from '../ocr/receipt.interface';

/**
 * Builds a beautiful Receipt Flex Message Bubble with Approve and Edit buttons.
 */
export function buildReceiptFlexMessage(
    data: ReceiptData,
    receiptId: string,
): messagingApi.FlexMessage {
    const liffEditUrl = process.env.LIFF_EDIT_URL ?? 'https://liff.line.me/your-liff-id';

    // Build item rows
    const itemRows: messagingApi.FlexComponent[] = data.items.map((item) => {
        const qty = item.quantity ?? 1;
        const subtotal = qty * item.price;
        return {
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: item.name,
                    size: 'sm',
                    color: '#555555',
                    flex: 5,
                    wrap: true,
                },
                {
                    type: 'text',
                    text: `${qty}`,
                    size: 'sm',
                    color: '#555555',
                    align: 'center',
                    flex: 1,
                },
                {
                    type: 'text',
                    text: `฿${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                    flex: 2,
                },
            ],
        } as messagingApi.FlexComponent;
    });

    // Fallback if no items found
    if (itemRows.length === 0) {
        itemRows.push({
            type: 'text',
            text: 'ไม่พบรายการสินค้า',
            size: 'sm',
            color: '#aaaaaa',
            align: 'center',
        });
    }

    const bubble: messagingApi.FlexBubble = {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#27AE60',
            paddingAll: 'lg',
            contents: [
                {
                    type: 'text',
                    text: '🧾 ใบเสร็จรับเงิน',
                    color: '#ffffff',
                    size: 'xs',
                    weight: 'bold',
                    margin: 'none',
                },
                {
                    type: 'text',
                    text: data.storeName,
                    color: '#ffffff',
                    size: 'xl',
                    weight: 'bold',
                    wrap: true,
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            spacing: 'sm',
            contents: [
                // Date row
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: '📅 วันที่',
                            size: 'xs',
                            color: '#888888',
                            flex: 2,
                        },
                        {
                            type: 'text',
                            text: data.date ?? 'ไม่ระบุ',
                            size: 'xs',
                            color: '#333333',
                            align: 'end',
                            flex: 3,
                        },
                    ],
                },
                { type: 'separator', margin: 'md' },
                // Items header
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'รายการ',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            flex: 5,
                        },
                        {
                            type: 'text',
                            text: 'จำนวน',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            align: 'center',
                            flex: 1,
                        },
                        {
                            type: 'text',
                            text: 'ราคา',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            align: 'end',
                            flex: 2,
                        },
                    ],
                },
                // Item rows
                {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    margin: 'sm',
                    contents: itemRows,
                },
                { type: 'separator', margin: 'md' },
                // Total row
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'ยอดรวม',
                            size: 'md',
                            weight: 'bold',
                            color: '#111111',
                            flex: 3,
                        },
                        {
                            type: 'text',
                            text: `฿${data.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            size: 'md',
                            weight: 'bold',
                            color: '#27AE60',
                            align: 'end',
                            flex: 3,
                        },
                    ],
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            paddingAll: 'md',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#27AE60',
                    height: 'sm',
                    flex: 1,
                    action: {
                        type: 'postback',
                        label: 'ยืนยัน',
                        data: `action=approve&id=${receiptId}`,
                        displayText: 'ยืนยันการบันทึก',
                    },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    height: 'sm',
                    flex: 1,
                    action: {
                        type: 'uri',
                        label: 'แก้ไข',
                        uri: `${liffEditUrl}?id=${receiptId}`,
                    },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    color: '#E74C3C',
                    height: 'sm',
                    flex: 1,
                    action: {
                        type: 'postback',
                        label: 'ยกเลิก',
                        data: `action=cancel&id=${receiptId}`,
                        displayText: 'ยกเลิกใบเสร็จ',
                    },
                },
            ],
        },
    };

    return {
        type: 'flex',
        altText: `ใบเสร็จจาก ${data.storeName} ยอดรวม ฿${data.totalAmount.toFixed(2)}`,
        contents: bubble,
    };
}

/**
 * Builds a final Receipt Flex Message Bubble without Approve/Edit buttons.
 * Shows status as Approved or Cancelled.
 */
export function buildFinalReceiptFlexMessage(
    data: ReceiptData,
    status: string,
): messagingApi.FlexMessage {
    // Build item rows
    const itemRows: messagingApi.FlexComponent[] = data.items.map((item) => {
        const qty = item.quantity ?? 1;
        const subtotal = qty * item.price;
        return {
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: item.name,
                    size: 'sm',
                    color: '#555555',
                    flex: 5,
                    wrap: true,
                },
                {
                    type: 'text',
                    text: `${qty}`,
                    size: 'sm',
                    color: '#555555',
                    align: 'center',
                    flex: 1,
                },
                {
                    type: 'text',
                    text: `฿${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                    flex: 2,
                },
            ],
        } as messagingApi.FlexComponent;
    });

    if (itemRows.length === 0) {
        itemRows.push({
            type: 'text',
            text: 'ไม่พบรายการสินค้า',
            size: 'sm',
            color: '#aaaaaa',
            align: 'center',
        });
    }

    const isApproved = status === 'approved';
    const statusText = isApproved ? 'อนุมัติเรียบร้อยแล้ว' : 'ยกเลิกเรียบร้อยแล้ว';
    const statusColor = isApproved ? '#27AE60' : '#E74C3C';

    const bubble: messagingApi.FlexBubble = {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: statusColor,
            paddingAll: 'lg',
            contents: [
                {
                    type: 'text',
                    text: '🧾 ใบเสร็จรับเงิน',
                    color: '#ffffff',
                    size: 'xs',
                    weight: 'bold',
                    margin: 'none',
                },
                {
                    type: 'text',
                    text: data.storeName || 'ไม่ระบุชื่อร้านค้า',
                    color: '#ffffff',
                    size: 'xl',
                    weight: 'bold',
                    wrap: true,
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            spacing: 'sm',
            contents: [
                // Date row
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: '📅 วันที่',
                            size: 'xs',
                            color: '#888888',
                            flex: 2,
                        },
                        {
                            type: 'text',
                            text: data.date ?? 'ไม่ระบุ',
                            size: 'xs',
                            color: '#333333',
                            align: 'end',
                            flex: 3,
                        },
                    ],
                },
                { type: 'separator', margin: 'md' },
                // Items header
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'รายการ',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            flex: 5,
                        },
                        {
                            type: 'text',
                            text: 'จำนวน',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            align: 'center',
                            flex: 1,
                        },
                        {
                            type: 'text',
                            text: 'ราคา',
                            size: 'xs',
                            color: '#888888',
                            weight: 'bold',
                            align: 'end',
                            flex: 2,
                        },
                    ],
                },
                // Item rows
                {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    margin: 'sm',
                    contents: itemRows,
                },
                { type: 'separator', margin: 'md' },
                // Total row
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'ยอดรวม',
                            size: 'md',
                            weight: 'bold',
                            color: '#111111',
                            flex: 3,
                        },
                        {
                            type: 'text',
                            text: `฿${(data.totalAmount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            size: 'md',
                            weight: 'bold',
                            color: statusColor,
                            align: 'end',
                            flex: 3,
                        },
                    ],
                },
                { type: 'separator', margin: 'md' },
                // Status Box
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'md',
                    paddingAll: 'md',
                    backgroundColor: isApproved ? '#EAF8F1' : '#FDEDEC',
                    cornerRadius: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: statusText,
                            size: 'sm',
                            weight: 'bold',
                            color: statusColor,
                            align: 'center',
                        }
                    ]
                }
            ],
        },
    };

    return {
        type: 'flex',
        altText: `ใบเสร็จจาก ${data.storeName} (${isApproved ? 'อนุมัติ' : 'ยกเลิก'})`,
        contents: bubble,
    };
}
