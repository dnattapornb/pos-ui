import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReceiptData } from './receipt.interface';

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);
    private readonly visionClient: ImageAnnotatorClient;
    private readonly geminiModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

    constructor(private readonly configService: ConfigService) {
        // Uses GOOGLE_APPLICATION_CREDENTIALS from environment automatically
        this.visionClient = new ImageAnnotatorClient();

        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            // Warn on startup but do NOT throw — let the app boot successfully.
            // The missing key will be caught and handled per-request in parseReceiptWithGemini().
            this.logger.warn('GEMINI_API_KEY is not set. Receipt parsing will fail until it is configured in .env');
            this.geminiModel = null as any;
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        }
    }

    /**
     * Step 1: Extract raw text from the image using Google Cloud Vision API.
     */
    async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
        this.logger.log('Sending image to Vision API for text extraction...');
        const [result] = await this.visionClient.textDetection(imageBuffer);
        const detections = result.textAnnotations;
        const rawText =
            detections && detections.length > 0 ? (detections[0].description ?? '') : '';

        this.logger.log('--- OCR RAW TEXT START ---');
        this.logger.log(`\n${rawText}`);
        this.logger.log('--- OCR RAW TEXT END ---');

        return rawText;
    }

    /**
     * Step 2: Use Gemini 2.5 Flash to parse and structure the raw OCR text into ReceiptData JSON.
     */
    async parseReceiptWithGemini(rawText: string): Promise<ReceiptData> {
        this.logger.log('Sending raw text to Gemini for structured parsing...');

        if (!this.geminiModel) {
            throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env file.');
        }

        const prompt = `คุณคือระบบ OCR ผู้เชี่ยวชาญที่อ่านข้อความจากใบเสร็จรับเงิน
จงวิเคราะห์ข้อความต่อไปนี้และตอบกลับเป็น JSON string ล้วนๆ เท่านั้น
ห้ามมี Markdown code block, ห้ามมี backtick, ห้ามมีคำอธิบายใดๆ นอกจาก JSON

JSON ต้องมี structure ดังนี้:
{
  "storeName": "ชื่อร้านค้า (string)",
  "date": "วันที่ในรูปแบบ DD/MM/YYYY หรือ null ถ้าไม่พบ",
  "totalAmount": ยอดรวมเป็นตัวเลข (number ไม่ใช่ string),
  "items": [
    { "name": "ชื่อสินค้า", "quantity": จำนวน (number), "price": ราคาต่อหน่วย (number) },
    ...
  ]
}

กฎ:
- storeName: ชื่อร้านมักอยู่บรรทัดแรกๆ ของใบเสร็จ
- date: หาวันที่จากรูปแบบ DD/MM/YYYY, DD-MM-YYYY, หรือรูปแบบที่คล้ายกัน ถ้าไม่พบให้ใส่ null
- totalAmount: ยอดรวมสุทธิ ไม่ใช่ subtotal ควรเป็นตัวเลขที่ใหญ่ที่สุดใกล้คำว่า Total/รวม/ยอด
- items: รายการสินค้าที่ซื้อ ไม่รวม tax, vat, ส่วนลด, บริการ
- quantity: จำนวนชิ้น/แก้ว/หน่วย ของสินค้านั้น ถ้าไม่ระบุให้ใส่ 1
- price ต้องเป็น number ราคาต่อหน่วย (ไม่ต้องมีเครื่องหมาย ฿ หรือ ,)

ข้อความจากใบเสร็จ:
${rawText}`;

        const result = await this.geminiModel.generateContent(prompt);
        const responseText = result.response.text();

        this.logger.log('--- GEMINI RESPONSE START ---');
        this.logger.log(responseText);
        this.logger.log('--- GEMINI RESPONSE END ---');

        // Clean Markdown code fences if Gemini adds them despite instructions
        const cleaned = responseText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        let parsed: ReceiptData;
        try {
            parsed = JSON.parse(cleaned) as ReceiptData;
        } catch (parseError) {
            this.logger.error('Failed to parse Gemini response as JSON', parseError);
            throw new Error(`Gemini returned invalid JSON: ${cleaned.substring(0, 200)}`);
        }

        // Ensure required fields are present and typed correctly
        const data: ReceiptData = {
            storeName: String(parsed.storeName ?? 'ร้านค้าไม่ระบุชื่อ'),
            date: parsed.date ?? null,
            totalAmount: Number(parsed.totalAmount ?? 0),
            items: Array.isArray(parsed.items)
                ? parsed.items.map((item) => ({
                    name: String(item.name ?? ''),
                    quantity: Number(item.quantity ?? 1),
                    price: Number(item.price ?? 0),
                }))
                : [],
        };

        this.logger.log(`Parsed receipt: ${data.storeName}, ฿${data.totalAmount}, ${data.items.length} items`);
        return data;
    }

    /**
     * Main entry point: Extract text from image, then parse with Gemini.
     */
    async processReceipt(imageBuffer: Buffer): Promise<ReceiptData> {
        const rawText = await this.extractTextFromImage(imageBuffer);
        if (!rawText || rawText.trim().length === 0) {
            this.logger.warn('Vision API returned empty text. Returning empty receipt data.');
            return {
                storeName: 'ไม่สามารถอ่านได้',
                date: null,
                totalAmount: 0,
                items: [],
            };
        }
        return this.parseReceiptWithGemini(rawText);
    }
}
