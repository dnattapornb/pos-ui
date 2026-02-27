# LINE Receipt OCR API — Master Agent Prompt

## ภาพรวมระบบ (System Overview)

ระบบนี้คือ **NestJS REST API** ที่ทำหน้าที่เป็น LINE Webhook Receiver สำหรับประมวลผลใบเสร็จ/สลิปที่ผู้ใช้ส่งมาทางแชท LINE โดยมีขั้นตอนการทำงานดังนี้:

```
LINE User ──[ส่งรูปใบเสร็จ]──► LINE Platform
                                      │
                          POST /webhook (HMAC-SHA256)
                                      │
                               NestJS API (Port 3000)
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          Google Cloud Vision API             ไม่ใช่รูป → ไม่ทำอะไร
          (OCR → raw text)
                    │
           Gemini 2.0 Flash API
          (raw text → structured JSON)
                    │
           LINE Flex Message (การ์ดสวยงาม)
          ┌─────────────────────┐
          │  🧾 ใบเสร็จรับเงิน  │
          │  Cafe Amazon         │
          │  รายการ | จำนวน | ราคา │
          │  ...items...         │
          │  ยอดรวม ฿XXX.XX      │
          │  [✔ ยืนยัน] [✏️ แก้ไข] │
          └─────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Framework | NestJS 11 (TypeScript Strict) |
| OCR | Google Cloud Vision API v1 (`@google-cloud/vision ^5`) |
| AI Parsing | Google Gemini 2.0 Flash (`@google/generative-ai ^0.24`) |
| Messaging | LINE Messaging API v3 (`@line/bot-sdk ^10`) |
| HTTP | Express (via `@nestjs/platform-express`) |
| Config | `@nestjs/config` + `.env` file |

---

## System Requirements

ก่อนเริ่มต้น ผู้ใช้ต้องเตรียมสิ่งต่อไปนี้:

### 1. LINE Messaging API Channel
- สร้าง Channel บน [LINE Developers Console](https://developers.line.biz/)
- **LINE_CHANNEL_ACCESS_TOKEN** — Long-lived Access Token จาก Basic Settings
- **LINE_CHANNEL_SECRET** — Channel Secret จาก Basic Settings
- ตั้งค่า Webhook URL ชี้มาที่ `https://<your-domain>/webhook`
- เปิด "Use webhook" และปิด "Auto-reply messages"

### 2. Google Cloud Platform
- สร้าง GCP Project และเปิด API: **Cloud Vision API**
- สร้าง Service Account → สร้าง JSON Key → บันทึกเป็น `service-account.json` ที่ root project
- **GOOGLE_APPLICATION_CREDENTIALS** = `./service-account.json`

### 3. Google Gemini API Key
- รับ API Key จาก [Google AI Studio](https://aistudio.google.com/app/apikey)
- **GEMINI_API_KEY** = `AIza...`

### 4. (Optional) LINE LIFF
- **LIFF_EDIT_URL** — URL ของ LIFF App สำหรับปุ่ม "แก้ไข" ใน Flex Message

---

## The Master Prompt

> คัดลอก Prompt ด้านล่างนี้ไปสั่ง AI Coding Agent (เช่น Cursor, Copilot Agent, Gemini CLI) เพื่อสร้างโปรเจกต์นี้ขึ้นมาใหม่ตั้งแต่ศูนย์

---

```
You are an expert NestJS architect. Build a production-ready LINE Webhook API
from scratch using the exact specification below. Follow every constraint strictly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1: PROJECT BOOTSTRAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Create a new NestJS project named "line-receipt-ocr-api":
   npx @nestjs/cli new line-receipt-ocr-api --package-manager npm

2. Install ALL required dependencies (exact packages):
   npm install @google-cloud/vision @google/generative-ai @line/bot-sdk \
               @nestjs/config axios

3. tsconfig.json MUST have:
   {
     "compilerOptions": {
       "strict": true,
       "strictNullChecks": true,
       "noImplicitAny": true,
       "noUnusedLocals": false,
       "esModuleInterop": true,
       "experimentalDecorators": true,
       "emitDecoratorMetadata": true,
       "target": "ES2021",
       "module": "commonjs"
     }
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2: PROJECT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the following file structure exactly:

line-receipt-ocr-api/
├── .env                          (from .env.example, filled with real values)
├── .env.example
├── service-account.json          (GCP Service Account key, gitignored)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── ocr/
│   │   ├── ocr.module.ts
│   │   ├── ocr.service.ts
│   │   └── receipt.interface.ts
│   └── line/
│       ├── line.module.ts
│       ├── line.controller.ts
│       ├── line.service.ts
│       └── flex.builder.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3: ENVIRONMENT VARIABLES (.env.example)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
LINE_CHANNEL_SECRET=your_secret_here
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GEMINI_API_KEY=your_gemini_api_key_here
LIFF_EDIT_URL=https://liff.line.me/your-liff-id

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4: DATA INTERFACES (src/ocr/receipt.interface.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ReceiptItem {
    name: string;       // ชื่อสินค้า
    quantity: number;   // จำนวน (default 1 ถ้าใบเสร็จไม่ระบุ)
    price: number;      // ราคาต่อหน่วย (number เท่านั้น ไม่มี ฿ หรือ ,)
}

export interface ReceiptData {
    storeName: string;      // ชื่อร้านค้า
    date: string | null;    // DD/MM/YYYY หรือ null
    totalAmount: number;    // ยอดรวมสุทธิ
    items: ReceiptItem[];   // รายการสินค้า
    status?: string;        // "pending", "approved", "cancelled"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5: main.ts — rawBody & PORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { rawBody: true });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`🚀 Server running on port ${port}`);
}
bootstrap();

// CRITICAL: rawBody: true is REQUIRED for LINE signature validation (HMAC-SHA256)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6: app.module.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LineModule } from './line/line.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LineModule,
    ],
})
export class AppModule {}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7: ocr.service.ts — The Gemini Parsing Core
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL CONSTRAINTS for OcrService:

A) ALWAYS use model name: "gemini-2.0-flash"
   - DO NOT use "gemini-pro", "gemini-1.5-flash", or "gemini-2.5-flash"
   - "gemini-2.0-flash" is the only model guaranteed to work without 404 errors

B) Implement two public methods:
   - extractTextFromImage(imageBuffer: Buffer): Promise<string>
     → calls Google Cloud Vision API textDetection()
     → logs raw OCR text to Logger for debugging
   - parseReceiptWithGemini(rawText: string): Promise<ReceiptData>
     → sends rawText to Gemini with the exact prompt below
   - processReceipt(imageBuffer: Buffer): Promise<ReceiptData>
     → calls extractTextFromImage → parseReceiptWithGemini
     → returns empty ReceiptData if Vision returns empty string

C) Gemini Prompt (use EXACTLY this structure):
   ──────────────────────────────────────────────
   คุณคือระบบ OCR ผู้เชี่ยวชาญที่อ่านข้อความจากใบเสร็จรับเงิน
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
   ${rawText}
   ──────────────────────────────────────────────

D) After receiving Gemini response:
   - Strip markdown fences: replace /```json\s*/gi and /```\s*/g with ''
   - JSON.parse() the cleaned string
   - Normalize all fields with explicit type casting:
     - storeName: String(parsed.storeName ?? 'ร้านค้าไม่ระบุชื่อ')
     - date: parsed.date ?? null
     - totalAmount: Number(parsed.totalAmount ?? 0)
     - items: parsed.items.map(item => ({
         name: String(item.name ?? ''),
         quantity: Number(item.quantity ?? 1),
         price: Number(item.price ?? 0),
       }))

E) Error Handling:
   - If GEMINI_API_KEY is missing at bootstrap: log warn, set this.geminiModel = null as any
   - If geminiModel is null at call time: throw Error with clear message
   - If JSON.parse fails: throw Error with first 200 chars of bad response

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8: line.controller.ts — Webhook Endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Route: POST /webhook
- Validate LINE HMAC-SHA256 signature:
  hash = crypto.createHmac('SHA256', LINE_CHANNEL_SECRET)
             .update(req.rawBody)
             .digest('base64')
  Compare hash with x-line-signature header
  - If mismatch: Logger.warn (do NOT throw — LINE retries will loop)
- Call lineService.handleWebhook(body.events)
- Always return { status: 'success' } (even on error, to prevent LINE retries)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9: line.service.ts — Event Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement these event handlers:

handleWebhook(events: WebhookEvent[]): void
  - if event.type === 'message' && event.message.type === 'image' → handleImageMessage()
  - if event.type === 'postback' → handlePostback()
  - else → Logger.debug and skip

handleImageMessage(event):
  1. Extract userId from event.source.userId
  2. (Optional) Filter by allowedUserId whitelist — log warn and reply error if not allowed
  3. Download image: lineBlobClient.getMessageContent(event.message.id) → stream → Buffer.concat()
  4. Call ocrService.processReceipt(imageBuffer) → ReceiptData
  5. Generate receiptId: `rcpt_${Date.now()}_${Math.random().toString(36).substring(2,8)}`
  6. Insert into DB with `status: "pending"`
  7. Build Flex Message: buildReceiptFlexMessage(receiptData, receiptId)
  8. lineClient.replyMessage({ replyToken, messages: [flexMessage] })
  9. On any error: safeReplyText(replyToken, 'ขออภัย เกิดข้อผิดพลาด...')

handlePostback(event):
  - Parse event.postback.data as URLSearchParams
  - Query DB for receiptId. If status !== 'pending', reply "ไม่สามารถทำรายการได้ เนื่องจากใบเสร็จนี้ได้ทำการอนุมัติ(หรือยกเลิก)ไปแล้ว"
  - if action === 'approve':
      Update DB status = 'approved'. 
      Reply with Final Flex Message (no buttons) with status "อนุมัติเรียบร้อยแล้ว".
  - if action === 'cancel':
      Update DB status = 'cancelled'.
      Reply with Final Flex Message (no buttons) with status "ยกเลิกเรียบร้อยแล้ว".

safeReplyText(replyToken, text):
  - try/catch wrapper around lineClient.replyMessage text reply
  - Never throws — only logs error

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10: flex.builder.ts — LINE Flex Message Layout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Function signature:
  buildReceiptFlexMessage(data: ReceiptData, receiptId: string): messagingApi.FlexMessage

Bubble layout (type: 'bubble', size: 'kilo'):

HEADER (backgroundColor: '#27AE60'):
  - Row 1 text: "🧾 ใบเสร็จรับเงิน" (xs, bold, white)
  - Row 2 text: data.storeName (xl, bold, white, wrap)

BODY (layout: vertical, paddingAll: lg, spacing: sm):
  1. Date row (horizontal box):
     - "📅 วันที่" (xs, #888888, flex: 2)
     - data.date ?? 'ไม่ระบุ' (xs, #333333, align: end, flex: 3)
  2. Separator
  3. Items table header (horizontal box, margin: md):
     - "รายการ" (xs, #888888, bold, flex: 5)
     - "จำนวน" (xs, #888888, bold, align: center, flex: 1)
     - "ราคา"  (xs, #888888, bold, align: end, flex: 2)
  4. Items box (vertical, spacing: sm, margin: sm):
     For each item:
       horizontal box with 3 columns:
       - item.name (sm, #555555, flex: 5, wrap: true)
       - `${item.quantity}` (sm, #555555, align: center, flex: 1)
       - `฿${(item.quantity * item.price).toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2})}`
         (sm, #111111, align: end, flex: 2)
     Fallback if items is empty:
       text "ไม่พบรายการสินค้า" (sm, #aaaaaa, align: center)
  5. Separator
  6. Total row (horizontal box, margin: md):
     - "ยอดรวม" (md, bold, #111111, flex: 3)
     - `฿${data.totalAmount.toLocaleString(...)}` (md, bold, #27AE60, align: end, flex: 3)

FOOTER (horizontal, spacing: sm, paddingAll: md):
  Button 1 (primary, #27AE60, height: sm, flex: 1):
    - type: postback, label: "ยืนยัน"
    - data: `action=approve&id=${receiptId}`
    - displayText: "ยืนยันการบันทึก"
  Button 2 (secondary, height: sm, flex: 1):
    - type: uri, label: "แก้ไข"
    - uri: `${LIFF_EDIT_URL}?id=${receiptId}`
  Button 3 (secondary, #E74C3C, height: sm, flex: 1):
    - type: postback, label: "ยกเลิก"
    - data: `action=cancel&id=${receiptId}`
    - displayText: "ยกเลิกใบเสร็จ"

Final FlexMessage wrapper (For Postbacks / Final State):
  When `status` is approved or cancelled, hide the footer items and show a solid background color on top, representing the final status ("อนุมัติเรียบร้อยแล้ว" / "ยกเลิกเรียบร้อยแล้ว").
  { type: 'flex', altText: `ใบเสร็จจาก ${data.storeName} (${isApproved ? 'อนุมัติ' : 'ยกเลิก'})`, contents: bubble }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 11: MODULE WIRING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ocr.module.ts:
  @Module({ providers: [OcrService], exports: [OcrService] })
  export class OcrModule {}

line.module.ts:
  @Module({ imports: [OcrModule], controllers: [LineController], providers: [LineService] })
  export class LineModule {}

app.module.ts:
  @Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), LineModule] })
  export class AppModule {}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 12: GLOBAL CONSTRAINTS (MUST FOLLOW)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. STRICT TYPESCRIPT — NO `any` except where LINE SDK forces it:
   - event handler params may use `any` for LINE WebhookEvent subtypes
   - ALL other variables must have explicit types

2. GEMINI MODEL NAME — MUST be exactly: "gemini-2.0-flash"
   - ANY other model name WILL cause 404 Model Not Found errors

3. RAW BODY — NestFactory.create(AppModule, { rawBody: true }) is MANDATORY
   - Without this, req.rawBody is undefined → HMAC validation silently fails

4. NEVER THROW in Webhook Handler — always catch and return { status: 'success' }
   - LINE Platform treats non-2xx as delivery failure and will retry infinitely

5. HMAC Validation — LOG WARN on mismatch, do NOT return 401
   - Returning 401 causes LINE to retry → log spam and duplicate processing

6. GRACEFUL BOOT — if GEMINI_API_KEY is missing, app MUST still start
   - Throw error per-request, not at bootstrap

7. LOGGER — use NestJS built-in Logger (not console.log) in every service

8. ALL prices and amounts — use Number() casting, never parseInt/parseFloat
   - Prevents NaN from string "140.00" edge cases

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 13: VERIFICATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After implementation, verify:
[ ] npm run build — TypeScript compiles with zero errors
[ ] npm run start:dev — Server starts on configured PORT
[ ] LINE Webhook URL set to https://<host>/webhook
[ ] Send a receipt image via LINE → Flex Message card appears
[ ] Flex Message shows: store name, date, items table (name/qty/price), total
[ ] ✔ ยืนยัน button triggers postback → "บันทึกสำเร็จ" text reply
[ ] Non-image messages → silently ignored (no crash)
[ ] Unauthorized userId → "ขออภัย คุณไม่มีสิทธิ์" reply
[ ] Missing GEMINI_API_KEY → app boots but returns error message on image send
```

---

*Generated from production codebase analysis — LINE Receipt OCR API v1.0*
*Last updated: 2026-02-25*
