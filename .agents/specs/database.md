# Database Schema Reference (MySQL 8 / TypeORM)

> This is the precise, source-of-truth schema reference for the project.
> Architecture and design rationale live in `design.md`; this file documents the
> concrete tables, columns, types, keys, and relations as defined by the TypeORM
> entities under `src/`. Keep this file in sync whenever an entity changes.

Naming follows `.agents/references/naming-conventions.md`: tables/columns are
`snake_case`, primary key is `id`, foreign keys are `<table>_id`. Class
properties are `camelCase` and mapped to columns via `@Column({ name: '...' })`.

## Entity Relationship Overview

```text
receipt 1 ──< receipt_item                 (OCR receipts)

product 1 ──< product_unit                 (POS: one product, many sellable units/barcodes)
product 1 ──1 inventory                     (current stock, in base unit)
product 1 ──< inventory_transaction         (immutable stock ledger: IN / OUT)
```

---

## POS Domain

### Table `product`

Source: `src/pos/entities/product.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `sku` | VARCHAR | UNIQUE, NOT NULL | Internal stock-keeping unit |
| `name` | VARCHAR | NOT NULL | Display name (Thai allowed) |
| `base_unit_name` | ENUM(`UnitName`) | NOT NULL | Smallest stock unit (multiplier = 1) |
| `cost_price` | DECIMAL(10,2) | DEFAULT 0 | Cost per base unit |
| `published` | BOOLEAN | DEFAULT true | Soft-delete flag (false = deleted) |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

Relations: `OneToMany` → `product_unit` (cascade); `OneToOne` → `inventory` (cascade).

### Table `product_unit`

Source: `src/pos/entities/product-unit.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `product_id` | INT | FK → `product.id`, ON DELETE CASCADE | |
| `barcode` | VARCHAR | UNIQUE, NOT NULL | Scanned at POS; index for fast lookup |
| `unit_name` | ENUM(`UnitName`) | NOT NULL | e.g. BOTTLE / PACK / CARTON |
| `multiplier` | INT | NOT NULL | How many base units this unit equals |
| `retail_price` | DECIMAL(10,2) | NOT NULL | Price for this unit |
| `wholesale_price` | DECIMAL(10,2) | NOT NULL | Wholesale price for this unit |
| `published` | BOOLEAN | DEFAULT true | Soft-delete flag |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

A single product maps to multiple barcodes/units. All stock math converts a unit
qty to base units using `qty * multiplier`.

### Table `inventory`

Source: `src/pos/entities/inventory.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `product_id` | INT | **PK**, FK → `product.id`, ON DELETE CASCADE | One row per product |
| `qty_in_base_unit` | INT | DEFAULT 0 | Current stock, always in base unit |

Single source of truth for current stock. Updated under a pessimistic write lock
during `receiveGoods` / `checkout` to prevent race conditions.

### Table `inventory_transaction` (ledger)

Source: `src/pos/entities/inventory-transaction.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `product_id` | INT | FK → `product.id`, ON DELETE CASCADE | |
| `type` | ENUM(`IN`, `OUT`) | NOT NULL | `TransactionType` |
| `qty` | INT | NOT NULL | Quantity in base unit |
| `reference_id` | VARCHAR | NULLABLE | e.g. `RCV-<ts>`, `ORDER-<ts>` |
| `created_at` | DATETIME | auto | |

Append-only audit trail. Every stock movement writes one row so stock changes are
always traceable.

### Enum `UnitName`

Source: `src/pos/enums/unit.enum.ts`

`PIECE`, `SACHET`, `BOTTLE`, `CAN`, `CUP`, `BOX`, `PACK`, `DOZEN`, `CARTON`, `CRATE`

---

## Receipt (OCR) Domain

### Table `receipt`

Source: `src/receipt/receipt.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | CHAR(36) UUID | PK | Generated UUID |
| `user_id` | VARCHAR | NOT NULL | LINE user id |
| `store_name` | VARCHAR | NOT NULL | |
| `date` | VARCHAR(50) | NULLABLE | Raw receipt date string |
| `total_amount` | DECIMAL(10,2) | DEFAULT 0.00 | |
| `status` | ENUM(`pending`,`approved`,`cancelled`) | DEFAULT `pending` | `ReceiptStatus` |
| `created_at` | DATETIME | auto | |
| `updated_at` | DATETIME | auto | |

Relations: `OneToMany` → `receipt_item` (cascade, eager).

### Table `receipt_item`

Source: `src/receipt/receipt-item.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `name` | VARCHAR | NOT NULL | |
| `quantity` | INT | DEFAULT 1 | |
| `price` | DECIMAL(10,2) | DEFAULT 0.00 | |
| `receipt_id` | CHAR(36) | FK → `receipt.id`, ON DELETE CASCADE | |

### Enum `ReceiptStatus`

Source: `src/receipt/receipt.entity.ts` — `pending`, `approved`, `cancelled`.
