export class ReceiptItem {
    name!: string;
    quantity!: number;
    price!: number;
}

export class ReceiptData {
    storeName!: string;
    date!: string | null;
    totalAmount!: number;
    items!: ReceiptItem[];
    status?: string;
}
