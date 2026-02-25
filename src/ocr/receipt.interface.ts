export interface ReceiptItem {
    name: string;
    quantity: number;
    price: number;
}

export interface ReceiptData {
    storeName: string;
    date: string | null;
    totalAmount: number;
    items: ReceiptItem[];
}
