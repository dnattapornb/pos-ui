# Phase: Database Migration (MongoDB to MySQL 8)

- [x] Remove Mongoose dependencies and configure TypeORM with MySQL.
- [x] Create `Receipt` and `ReceiptItem` TypeORM entities.
- [x] Refactor `ReceiptService` to use TypeORM repositories.
- [x] Update unit tests for `ReceiptService` with mocked TypeORM repositories.

# Phase: POS API Implementation

- [x] Create POS Entities (`Product`, `ProductUnit`, `Inventory`, `InventoryTransaction`).
- [x] Create `PosModule`, `PosController`, and `PosService`.
- [x] Implement `PosService.seedProducts()` logic to generate 5 sample products.
- [x] Implement `PosService.receiveGoods()` and `PosService.checkout()` using TypeORM Transactions.
- [x] Register `PosModule` in `app.module.ts`.
- [x] Write unit tests for `PosService` and `PosController`.
- [x] Verify type safety.
