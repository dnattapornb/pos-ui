# Architecture & Design Guidelines (API)

## 1. Core Architecture
- **Framework:** NestJS (Modular Architecture).
- **Modules:** 
  - `LineModule` (Handles Webhook, Event Routing, Flex Message Building).
  - `OcrModule` (Handles Google Cloud Vision API and Gemini interactions).
  - `DatabaseModule` / `TypeOrmModule` (MySQL 8 database layer).

## 2. LINE Webhook Design
- **Single Endpoint:** `POST /webhook`.
- **Validation:** Must use `crypto.createHmac('SHA256', LINE_CHANNEL_SECRET)` against the `x-line-signature` header.
- **Event Routing:** 
  - `message` (type `image`) -> Extract image, run OCR, send to Gemini, save to DB (`pending`), reply with Flex Message.
  - `postback` -> Extract payload (`action=approve` or `cancel`), verify DB state, update status, reply with Final Flex Message.

## 3. Database Design (MySQL 8)
- **Table `receipt`**: Stores basic metadata (`id`, `storeName`, `date`, `totalAmount`, `status`, `userId`).
- **Table `receipt_item`** (or JSON column): Stores individual items (`name`, `quantity`, `price`).
- **Status Enum:** `pending`, `approved`, `cancelled`.

## 4. Error Handling
- **Log Everything:** Use NestJS built-in `Logger`.
- **Never 500 on Webhook:** Always return `200 OK` to LINE to prevent retry floods. If an error occurs, log it and optionally reply to the user with a safe error message (`safeReplyText`).

## 5. Flex Message Design
- **Layout:** Kilo size bubble, green header `#27AE60`.
- **States:** 
  - *Pending:* Shows action footer with `ยืนยัน`, `แก้ไข` (LIFF URL), `ยกเลิก`.
  - *Final (Approved/Cancelled):* Footer is hidden, shows solid background indicating final status.

## 6. Testing Strategy
- **Centralized Testing:** All tests must be located in `test/unit/` mirroring the `src/` directory structure.
- **Mocking:** Mock all external dependencies (Google Vision, Gemini API, LINE SDK, TypeORM).
- **Test Coverage:** Every service and controller method must be covered, especially edge cases (missing API keys, LINE signature mismatch, OCR failure).
