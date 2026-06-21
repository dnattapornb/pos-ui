# Phase R3 — Barcode Lookup API with Redis Cache-Aside

**Goal:** เพิ่ม endpoint `GET /pos/barcode/:barcode` สำหรับ POS Terminal scan barcode
พร้อม Redis Cache-Aside (product/unit info cached TTL 24h) + Hybrid Stock query (qtyInBaseUnit live จาก MySQL เสมอ)

**Pattern:** Cache-Aside Lazy Loading + Hybrid  
**Cache Key:** `pos:barcode:{barcode}` → JSON  
**TTL:** 86400s (24h)  
**Invalidation:** ทันที เมื่อ update/delete product หรือ product_unit

**Affected files:**
- `package.json` — add `ioredis`
- `src/redis/redis.module.ts` *(NEW)*
- `src/redis/redis.service.ts` *(NEW)*
- `src/app.module.ts`
- `src/pos/pos.module.ts`
- `src/pos/pos.controller.ts`
- `src/pos/pos.service.ts`
- `src/pos/dto/pos.dto.ts`
- `http/pos.http`
- `test/unit/redis/redis.service.spec.ts` *(NEW)*
- `test/unit/pos/pos.service.spec.ts`
- `test/unit/pos/pos.controller.spec.ts`
- `.agents/specs/design.md` *(done ✅)*

---

## R3.1 — RedisModule & RedisService

- [x] `npm install ioredis` เพิ่ม dependency
- [x] สร้าง `src/redis/redis.module.ts`
  - Global module (`isGlobal: true`)
  - inject `ConfigService` อ่าน `REDIS_HOST` (default `localhost`), `REDIS_PORT` (default `6379`), `REDIS_PASSWORD` (optional)
  - export `RedisService`
- [x] สร้าง `src/redis/redis.service.ts` ด้วย methods:
  - `get(key: string): Promise<string | null>`
  - `set(key: string, value: string, ttlSeconds: number): Promise<void>`
  - `del(key: string): Promise<void>`
  - `delPattern(pattern: string): Promise<void>` — ใช้ SCAN + DEL (ไม่ใช้ KEYS ใน production)
  - log `[Redis] ✓ CACHE HIT!` / `[Redis] ✗ CACHE MISS!` ผ่าน NestJS `Logger`
  - Graceful degradation: ถ้า Redis error → log warn + return `null` (ไม่ throw 500)
- [x] import `RedisModule` ใน `src/app.module.ts`

---

## R3.2 — Barcode Lookup Endpoint

- [x] เพิ่ม `BarcodeLookupResponseDto` ใน `src/pos/dto/pos.dto.ts`:
  ```
  barcode, unitId, unitName, multiplier,
  retailPrice, wholesalePrice,
  productId, productName, sku, baseUnitName, costPrice,
  qtyInBaseUnit  ← live จาก MySQL
  ```
- [x] import `RedisModule` ใน `src/pos/pos.module.ts`
- [x] inject `RedisService` ใน `PosService`
- [x] เพิ่ม method `lookupBarcode(barcode: string): Promise<BarcodeLookupResponseDto>` ใน `PosService`:
  1. Redis GET `pos:barcode:{barcode}`
  2. HIT → parse JSON (product/unit info)  
     MISS → query `product_unit LEFT JOIN product WHERE barcode = ?` → throw 400 ถ้าไม่พบ → Redis SET TTL 86400
  3. query `inventory WHERE product_id = ?` (live เสมอ)
  4. merge → return `BarcodeLookupResponseDto`
- [x] เพิ่ม endpoint ใน `PosController`:
  ```typescript
  @Get('barcode/:barcode')
  lookupBarcode(@Param('barcode') barcode: string)
  ```
  - Note: `@Param('barcode')` ใช้เป็น string ธรรมดา (ไม่ใช้ `ParseIntPipe`)

---

## R3.3 — Cache Invalidation

เพิ่ม cache invalidation ใน `PosService` สำหรับทุก method ที่แก้ไขสินค้า:

- [x] `updateProductUnit(id)` → หลัง save: `await this.redis.del(\`pos:barcode:${unit.barcode}\`)`
- [x] `deleteProductUnit(id)` → หลัง save: `await this.redis.del(\`pos:barcode:${unit.barcode}\`)`
- [x] `updateProduct(id)` → หลัง commit transaction (ก่อน findOne): loop units → del แต่ละ barcode
- [x] `deleteProduct(id)` → หลัง save: loop units → del แต่ละ barcode
- [x] `createProductUnit(dto)` → **ไม่ต้อง** invalidate (key ยังไม่มีใน cache)

---

## R3.4 — HTTP Test File

- [x] เพิ่ม section ใน `http/pos.http`:
  ```http
  ###############################################################################
  # Barcode Lookup  (/pos/barcode/:barcode)  — Redis Cache-Aside + Hybrid Stock
  ###############################################################################

  ### CACHE MISS (first call) -> MySQL query -> set Redis TTL 24h
  GET {{baseUrl}}/pos/barcode/8851000

  ### CACHE HIT (second call) -> Redis hit -> live inventory query only
  GET {{baseUrl}}/pos/barcode/8851000

  ### Barcode not found -> 400
  GET {{baseUrl}}/pos/barcode/0000000
  ```

---

## R3.5 — Unit Tests

- [x] สร้าง `test/unit/redis/redis.service.spec.ts`:
  - mock `ioredis` client
  - test `get` → HIT / MISS
  - test `set` → เรียก `setex` ถูกต้อง
  - test `del` → เรียก `del` ถูก key
  - test `delPattern` → เรียก SCAN + DEL
  - test graceful degradation เมื่อ Redis throw error

- [x] อัปเดต `test/unit/pos/pos.service.spec.ts`:
  - mock `RedisService` ให้กับ `PosService`
  - เพิ่ม describe block `lookupBarcode`:
    - `CACHE HIT` → parse JSON, query inventory live, return merged dto, **ไม่ query MySQL product**
    - `CACHE MISS` → query MySQL, set cache, query inventory, return dto
    - `CACHE MISS + barcode ไม่มี` → throw BadRequestException 400
    - Redis error ระหว่าง GET → fallback to MySQL (graceful)
  - เพิ่ม test cache invalidation:
    - `updateProductUnit` → `redis.del` ถูก key
    - `deleteProductUnit` → `redis.del` ถูก key
    - `updateProduct` → `redis.del` ถูก key สำหรับทุก unit
    - `deleteProduct` → `redis.del` ถูก key สำหรับทุก unit

- [x] อัปเดต `test/unit/pos/pos.controller.spec.ts`:
  - เพิ่ม mock `lookupBarcode` ใน service stub
  - test `GET /pos/barcode/:barcode` → เรียก `service.lookupBarcode('8851000')`

---

## R3.6 — Verification

- [x] รัน `npx tsc --noEmit` → ต้องผ่าน 0 error
- [x] รัน `npm run test test/unit/redis/redis.service.spec.ts` → 100% pass
- [x] รัน `npm run test test/unit/pos/pos.service.spec.ts` → 100% pass
- [x] รัน `npm run test test/unit/pos/pos.controller.spec.ts` → 100% pass
- [x] รัน `npm run lint` → ไฟล์ที่แก้ทั้งหมด (redis/*, pos/*, tests) ผ่าน 0 error/warning
      (หมายเหตุ: ยังมี lint error เดิมค้างใน `line.service.ts`, `ocr.service.ts`, `receipt.controller.ts`, `main.ts` ที่ไม่เกี่ยวกับงานนี้)
- [ ] ทดสอบ manual ด้วย `http/pos.http` (ต้องรัน server + Redis เอง — ยังไม่ได้รันในสภาพแวดล้อมนี้):
  - CACHE MISS log → ⏳
  - CACHE HIT log → ⏳
  - Invalidation หลัง PUT unit → ⏳
  - Barcode ไม่มี → 400 → ⏳
- [x] อัปเดต checkbox นี้ทุกข้อเมื่อเสร็จ
- [x] สร้าง commit message ตาม `git-conventional-commit-message` skill
