# Architecture & Design Guidelines (API)

> **Last updated:** 2026-06-21 — synced from actual source code (`src/`, `http/pos.http`)
> **Redis Barcode Cache design:** added 2026-06-21 (R3 phase)

---

## 1. Core Architecture

- **Framework:** NestJS 11 (Modular Architecture), TypeScript Strict
- **Database:** MySQL 8 via TypeORM (`synchronize: true` in dev), timezone `+07:00`
- **Cache:** Redis via `ioredis` — Cache key: `pos:barcode:{barcode}`, TTL 24h
- **AI/OCR:** Google Cloud Vision API for raw text, **Gemini 2.5 Flash** for JSON structuring.
- **Modules:**
  - `LineModule` — Webhook receiver, event routing, Flex Message builder
  - `OcrModule` — Google Cloud Vision API + Gemini 2.0 Flash integration
  - `ReceiptModule` — Receipt entity persistence
  - `AuthModule` — Stub LINE OAuth endpoint (`POST /api/auth/line`)
  - `PosModule` — Full POS: Products, Categories, Units, Inventory, Orders, Suppliers, Purchase Orders
  - `UsersModule` — User management (ADMIN / CASHIER roles, bcrypt passwords)
  - `RedisModule` — Global module, wraps `ioredis`, provides `RedisService` (get/set/del/delPattern + Logger)

---

## 2. LINE Webhook Design

- **Endpoint:** `POST /webhook`
- **Validation:** HMAC-SHA256 via `crypto.createHmac` against `x-line-signature` header. `rawBody` is mandatory.
- **Event Routing:**
  - `message` (type `image`) → OCR → Gemini → save receipt (`pending`) → reply Flex Message
  - `postback` → parse `action=approve|cancel` → update receipt status → reply Final Flex Message
- **Error Handling:** Never return 4xx/5xx to LINE. Always `200 OK`. Log errors and optionally reply with `safeReplyText`.

---

## 3. Authentication (Stub)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/line` | LINE OAuth stub — accepts `{ idToken }`, returns `{ accessToken }` (mock JWT) |

> ⚠️ No real JWT validation or guards are implemented yet. All POS and User endpoints are currently **unprotected**.

---

## 4. POS Module — API Endpoints

Base prefix: `/pos` (controller `@Controller('pos')`)

### 4.1 Categories

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/categories` | — | List all categories |
| GET | `/pos/category/:id` | — | Get category by id |
| POST | `/pos/category` | `{ name: string }` | Create category (name unique) |
| PUT | `/pos/category/:id` | `{ name?: string }` | Update category (partial) |
| DELETE | `/pos/category/:id` | — | Hard delete (fails 400 if has products) |

### 4.2 Products

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/products` | — | List all **published** products (with units + inventory) |
| GET | `/pos/product/:id` | — | Get **published** product by id (with units + inventory + category) |
| POST | `/pos/product` | `CreateProductDto` | Create product + units in one transaction |
| PUT | `/pos/product/:id` | `UpdateProductDto` | Partial update; upsert units by barcode if `units` provided |
| DELETE | `/pos/product/:id` | — | Soft delete: sets `published=false` on product + all its units |

**`CreateProductDto`:**
```
sku: string (required)
name: string (required)
baseUnitName: UnitName (required, enum)
costPrice: number ≥ 0, max 2 decimal (required)
categoryId?: number (optional)
units: CreateProductUnitDto[] (required, min 1)
```

**`UpdateProductDto`:**
```
sku?: string
name?: string
baseUnitName?: UnitName
costPrice?: number ≥ 0
categoryId?: number | null  (null removes category)
units?: CreateProductUnitDto[]  (upsert by barcode — no deletion)
published?: boolean  (true = republish, false = unpublish)
```

> **Upsert logic (PUT units):** matched by `barcode`. If barcode exists → update + set `published=true`. If not → create new unit. Units **not** in payload are left untouched.

> **Cache invalidation:** `updateProduct` and `deleteProduct` will del `pos:barcode:{barcode}` for every unit belonging to that product immediately after the DB commit.

### 4.3 Barcode Lookup (Redis Cache-Aside + Hybrid Stock)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/barcode/:barcode` | — | Lookup product + unit by barcode; product/unit info from Redis cache, `qtyInBaseUnit` always live from MySQL |

**Response `BarcodeLookupResponseDto`:**
```
barcode:        string   ← lookup key
unitId:         number   ← FK to product_unit
unitName:       UnitName
multiplier:     number   ← base units per this unit
retailPrice:    number   ← used for POS checkout pricing
wholesalePrice: number
productId:      number
productName:    string
sku:            string
baseUnitName:   UnitName
costPrice:      number
qtyInBaseUnit:  number   ← ALWAYS fetched live from inventory table (not cached)
```

**Hybrid Lookup Flow:**
```
1. Redis GET pos:barcode:{barcode}
   ├─ HIT  → parse product/unit JSON (~2ms)
   └─ MISS → MySQL: product_unit JOIN product (~35ms)
              └─ Redis SET (TTL 86400s)
2. MySQL: SELECT qty_in_base_unit FROM inventory WHERE product_id = ? (~5ms)
3. Merge → return BarcodeLookupResponseDto
```

**Errors:** `400 Bad Request` if barcode not found in DB

### 4.4 Product Units (single unit CRUD)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/product/unit/:id` | — | Get published unit by id (with product relation) |
| POST | `/pos/product/unit` | `AddProductUnitDto` | Create a standalone unit for an existing product |
| PUT | `/pos/product/unit/:id` | `UpdateProductUnitDto` | Partial update (barcode, unitName, multiplier, prices, published) — **invalidates `pos:barcode:{barcode}` immediately** |
| DELETE | `/pos/product/unit/:id` | — | Soft delete: sets `published=false` — **invalidates `pos:barcode:{barcode}` immediately** |

**`AddProductUnitDto`:**
```
productId: number (required)
barcode: string (required, unique)
unitName: UnitName (required)
multiplier: number > 0 (required)
retailPrice: number ≥ 0, max 2 decimal (required)
wholesalePrice: number ≥ 0, max 2 decimal (required)
```

**`UpdateProductUnitDto`:**
```
barcode?: string
unitName?: UnitName
multiplier?: number > 0
retailPrice?: number ≥ 0
wholesalePrice?: number ≥ 0
published?: boolean
```

### 4.4 Suppliers

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/suppliers` | — | List all suppliers |
| GET | `/pos/supplier/:id` | — | Get supplier by id |
| POST | `/pos/supplier` | `{ name, contactInfo? }` | Create supplier |
| PUT | `/pos/supplier/:id` | `{ name?, contactInfo? }` | Partial update |
| DELETE | `/pos/supplier/:id` | — | Hard delete |

### 4.5 Purchase Orders (Stock IN)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/pos/purchase-order` | `CreatePurchaseOrderDto` | Create PO + receive goods into inventory (transactional) |

**`CreatePurchaseOrderDto`:**
```
supplierId?: number (optional)
items: PurchaseOrderItemDto[] (required, min 1)
  ├─ barcode: string (required)
  ├─ qty: number > 0 (required)
  └─ costPrice?: number ≥ 0 (optional; falls back to product.costPrice)
```

**Behavior:**
- PO status is immediately set to `COMPLETED` (no pending flow)
- Each item: `qtyInBaseUnit += qty × multiplier` with pessimistic write lock
- Ledger entry (`InventoryTransaction type=IN`) created per item
- `poNo` auto-generated: `PO-{timestamp}`
- Returns `{ message, poNo }`

### 4.6 Checkout (Stock OUT)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/pos/checkout` | `CheckoutDto` | Create order, deduct stock, record transactions (transactional) |

**`CheckoutDto`:**
```
items: CheckoutItemDto[] (required, min 1)
  ├─ barcode: string (required)
  └─ qty: number > 0 (required)
paymentMethod?: PaymentMethod  (default: CASH)
discountAmount?: number ≥ 0, max 2 decimal  (default: 0)
cashierId?: number  (optional, FK → user.id)
referenceId?: string  (optional; auto: ORDER-{timestamp})
```

**Behavior:**
- `orderNo` = `referenceId` (or auto-generated)
- `paymentStatus` = `COMPLETED` immediately
- `unitPrice` = `productUnit.retailPrice`
- `subtotal` = `unitPrice × qty`
- `totalAmount` = sum of all subtotals
- `netAmount` = `totalAmount - discountAmount`
- Stock locked with pessimistic write per inventory row
- Ledger entry (`InventoryTransaction type=OUT`) created per item
- 400 if barcode not found, insufficient stock, or discount > total

### 4.7 Orders

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/pos/orders` | — | List all orders (with items), newest first |
| GET | `/pos/order/:id` | — | Get order by id (items + productUnit.product + cashier) |

### 4.8 Dev Seed

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pos/seed` | **Dev only.** Truncates POS tables and seeds 5 sample products |

---

## 5. Users Module — API Endpoints

Base prefix: none (controller `@Controller()`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/users` | — | List all users (`passwordHash` stripped from response) |
| GET | `/user/:id` | — | Get user by id |
| POST | `/user` | `CreateUserDto` | Create user (bcrypt hash password, check duplicate username) |
| PUT | `/user/:id` | `UpdateUserDto` | Partial update (username, password, role) |

**`CreateUserDto`:**
```
username: string (required)
password: string (required, minLength 6) → hashed with bcrypt (10 rounds)
role?: Role  (default: CASHIER)
```

**`UpdateUserDto`:**
```
username?: string  (duplicate check)
password?: string (minLength 6) → re-hashed with bcrypt
role?: Role
```

**Response shape** (`UserResponseDto` — passwordHash excluded):
```json
{ "id", "username", "role", "createdAt", "updatedAt" }
```

---

## 6. Entity & Schema Reference

### Enums

| Enum | Values |
|------|--------|
| `UnitName` | `PIECE`, `SACHET`, `BOTTLE`, `CAN`, `CUP`, `BOX`, `PACK`, `DOZEN`, `CARTON`, `CRATE` |
| `PaymentMethod` | `CASH`, `PROMPTPAY` |
| `OrderStatus` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `PurchaseOrderStatus` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `TransactionType` | `IN`, `OUT` |
| `Role` | `ADMIN`, `CASHIER` |

### Tables

#### `category`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `name` | varchar unique | |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `product`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `sku` | varchar unique | |
| `name` | varchar | |
| `base_unit_name` | enum(UnitName) | |
| `cost_price` | decimal(10,2) | default 0 |
| `category_id` | FK → category | nullable |
| `published` | boolean | default true; soft-delete flag |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `product_unit`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `product_id` | FK → product (CASCADE) | |
| `barcode` | varchar unique | lookup key at POS |
| `unit_name` | enum(UnitName) | |
| `multiplier` | int | units per base unit |
| `retail_price` | decimal(10,2) | |
| `wholesale_price` | decimal(10,2) | |
| `published` | boolean | default true; soft-delete flag |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `inventory`
| Column | Type | Notes |
|--------|------|-------|
| `product_id` | PK + FK → product (CASCADE) | 1:1 with product |
| `qty_in_base_unit` | int | always in base unit |

#### `inventory_transaction` (Ledger)
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `product_id` | FK → product (CASCADE) | |
| `type` | enum(IN, OUT) | |
| `qty` | int | in base units |
| `reference_id` | varchar nullable | PO number or Order number |
| `created_at` | datetime | |

#### `supplier`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `name` | varchar | |
| `contact_info` | varchar nullable | |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `purchase_order`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `po_no` | varchar unique | auto `PO-{timestamp}` |
| `supplier_id` | FK → supplier nullable | |
| `total_amount` | decimal(10,2) | |
| `status` | enum(PurchaseOrderStatus) | default PENDING; set COMPLETED immediately |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `order`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `order_no` | varchar unique | = referenceId or `ORDER-{timestamp}` |
| `total_amount` | decimal(10,2) | sum of item subtotals |
| `discount_amount` | decimal(10,2) | default 0 |
| `net_amount` | decimal(10,2) | total - discount |
| `payment_method` | enum(PaymentMethod) | |
| `payment_status` | enum(OrderStatus) | default PENDING; set COMPLETED immediately |
| `cashier_id` | FK → user nullable | |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

#### `order_item`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `order_id` | FK → order (CASCADE) | |
| `product_unit_id` | FK → product_unit | |
| `qty` | int | |
| `unit_price` | decimal(10,2) | = productUnit.retailPrice at time of sale |
| `subtotal` | decimal(10,2) | = unitPrice × qty |

#### `user`
| Column | Type | Notes |
|--------|------|-------|
| `id` | PK auto-increment | |
| `username` | varchar unique | |
| `password_hash` | varchar | bcrypt 10 rounds; never returned in API response |
| `role` | enum(Role) | default CASHIER |
| `created_at` | datetime(6) | |
| `updated_at` | datetime(6) | |

---

## 7. Inventory Flow

```
Stock IN  (createPurchaseOrder):
  qty_in_base_unit += item.qty × unit.multiplier
  InventoryTransaction (type=IN, referenceId=poNo)

Stock OUT (checkout):
  qty_in_base_unit -= item.qty × unit.multiplier
  InventoryTransaction (type=OUT, referenceId=orderNo)
  Guard: throw 400 if qty_in_base_unit < required
```

- Pessimistic write lock (`SELECT ... FOR UPDATE`) used on `inventory` row during both PO and checkout.
- All writes wrapped in TypeORM `QueryRunner` transaction.

---

## 8. Transaction Safety

| Operation | Uses QueryRunner? | Pessimistic Lock? |
|-----------|-------------------|-------------------|
| `createProduct` | ✅ | ❌ |
| `updateProduct` | ✅ | ❌ |
| `seedProducts` | ✅ | ❌ |
| `createPurchaseOrder` | ✅ | ✅ (inventory row) |
| `checkout` | ✅ | ✅ (inventory row) |

> **Rollback guard:** `if (queryRunner.isTransactionActive)` check before rollback prevents `TransactionNotStartedError` if the error is thrown after `commitTransaction()`.

---

## 9. Error Handling

- **POS endpoints:** throw `BadRequestException` (HTTP 400) on not-found, duplicate, insufficient stock.
- **User endpoints:** throw `NotFoundException` (HTTP 404) or `ConflictException` (HTTP 409) on not-found / duplicate username.
- **LINE Webhook:** always return HTTP 200; log errors via NestJS `Logger`.
- **Price Casting:** use `Number()` (never `parseInt`/`parseFloat`) to handle decimal strings from MySQL.

---

## 10. Testing Strategy

- **Location:** `test/unit/` mirroring `src/` (e.g. `src/pos/pos.service.ts` → `test/unit/pos/pos.service.spec.ts`).
- **Mocking:** Mock all external deps (Vision, Gemini, LINE SDK, TypeORM repositories, DataSource/QueryRunner).
- **Coverage:** Every service method and controller handler must be covered.
- **Lint-safe patterns:** Follow `.agents/skills/nestjs-unit-test/SKILL.md` for `unbound-method`, `no-unsafe-*`, and `no-unused-vars` rules.

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP listen port |
| `MYSQL_HOST` | No | `localhost` | MySQL host |
| `MYSQL_PORT` | No | `4306` | MySQL port |
| `MYSQL_USER` | No | `root` | MySQL username |
| `MYSQL_PASSWORD` | No | `root` | MySQL password |
| `MYSQL_DATABASE` | No | `pos` | MySQL database name |
| `LINE_CHANNEL_ACCESS_TOKEN` | Yes | — | LINE Messaging API token |
| `LINE_CHANNEL_SECRET` | Yes | — | HMAC signature secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | — | Path to GCP service account JSON |
| `GEMINI_API_KEY` | Yes* | — | Gemini API key (*graceful boot without it; throws per-request) |
| `LIFF_EDIT_URL` | Yes | — | LIFF URL for edit button in Flex Message |
| `REDIS_HOST` | No | `localhost` | Redis server host |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis password (empty = no auth) |

---

## 12. Soft Delete Convention

Both `product` and `product_unit` use a `published` boolean flag for soft deletes:
- `DELETE /pos/product/:id` → sets `product.published = false` AND all its `product_unit.published = false`
- `DELETE /pos/product/unit/:id` → sets `product_unit.published = false` only
- `GET /pos/products` and `GET /pos/product/:id` filter `WHERE published = true`
- `GET /pos/product/unit/:id` filters `WHERE published = true`
- `PUT /pos/product/:id` with `published: true/false` → explicit republish or unpublish

> ⚠️ `updateProduct` and `getProductById` are intentionally separate queries — `updateProduct` returns the product regardless of `published` status (using `productRepo.findOne` directly), while `getProductById` enforces `published = true`.

---

## 13. Redis Cache Strategy (Barcode Lookup)

### Pattern: Cache-Aside (Lazy Loading) + Hybrid Stock

| Field group | Source | TTL |
|-------------|--------|-----|
| product + unit info | Redis `pos:barcode:{barcode}` | 86400s (24h) |
| `qtyInBaseUnit` | MySQL `inventory` (live) | — (never cached) |

### Cache Key Format
```
pos:barcode:{barcode}   →  JSON string (BarcodeLookupResponseDto minus qtyInBaseUnit)
```

### Cache Invalidation Rules

| Service Method | Invalidates |
|----------------|-------------|
| `updateProduct(id)` | `pos:barcode:{b}` for all units of the product |
| `deleteProduct(id)` | `pos:barcode:{b}` for all units of the product |
| `updateProductUnit(id)` | `pos:barcode:{unit.barcode}` (single key) |
| `deleteProductUnit(id)` | `pos:barcode:{unit.barcode}` (single key) |
| `createProductUnit(dto)` | ❌ not needed (key never existed in cache) |

### RedisService API
```typescript
get(key: string): Promise<string | null>
set(key: string, value: string, ttlSeconds: number): Promise<void>
del(key: string): Promise<void>
delPattern(pattern: string): Promise<void>  // SCAN + DEL, avoid KEYS in production
```

### Performance Benchmark (from logs)
| Scenario | Latency |
|----------|---------|
| Full MySQL query (CACHE MISS) | ~35ms |
| Redis + live inventory (CACHE HIT) | ~7ms |
| Full miss + inventory | ~40ms (first scan only) |

### Graceful Degradation
- ถ้า Redis ไม่พร้อม (connection error) → service fallback ไปยัง MySQL โดยตรง (ไม่ throw 500)
- Boot ได้ปกติแม้ไม่มี Redis config (default `localhost:6379`)
