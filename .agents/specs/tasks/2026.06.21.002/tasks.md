# Phase: POS Entities REST API & Checkout Integration

**Goal:** พัฒนา REST API (Controller, Service, DTO) สำหรับ Category, User, Supplier, PurchaseOrder และปรับปรุงระบบ Checkout ให้บันทึกการขายลงตาราง Order/OrderItem อย่างสมบูรณ์

**Affected files:** 
- `src/pos/dto/pos.dto.ts`
- `src/pos/pos.controller.ts`
- `src/pos/pos.service.ts`
- `src/users/*` (Controller, Service, DTO, Module)
- `test/unit/pos/pos.controller.spec.ts`
- `test/unit/pos/pos.service.spec.ts`
- `test/unit/users/*`
- `http/pos.http`
- `.agents/references/pos-api.md`

## R2.1 — Category API

- [x] สร้าง DTO `CreateCategoryDto`, `UpdateCategoryDto`
- [x] เพิ่ม methods ใน `PosService`: `getAllCategories()`, `getCategoryById()`, `createCategory()`, `updateCategory()`, `deleteCategory()`
- [x] เพิ่ม endpoints ใน `PosController`: GET, POST, PUT, DELETE ภายใต้ `/pos/category...`
- [x] อัปเดต `CreateProductDto`, `UpdateProductDto` ให้มี `categoryId` (Optional)
- [x] แก้ไข logic ใน `pos.service.ts` (`createProduct`, `updateProduct`) ให้รองรับการนำ `categoryId` ไปผูกกับ Product
- [x] เพิ่ม Unit Test สำหรับ Category ใน `pos.controller.spec.ts` และ `pos.service.spec.ts`

## R2.2 — User API (Cashier/Admin)

- [ ] สร้าง `users.controller.ts`, `users.service.ts`, `users.module.ts` พร้อม DTO `CreateUserDto`, `UpdateUserDto` (เชื่อม Module ใน app.module.ts)
- [ ] เพิ่ม method ใน Service: `getAllUsers()`, `getUserById()`, `createUser()` (อาจใช้ bcrypt เข้ารหัสรหัสผ่าน หรือ hash พื้นฐาน), `updateUser()`
- [ ] เพิ่ม endpoints ฝั่ง Controller: `/users/...`
- [ ] เพิ่ม Unit Test `users.controller.spec.ts` และ `users.service.spec.ts`

## R2.3 — Supplier & Purchase Order API

- [ ] สร้าง DTO `CreateSupplierDto`, `UpdateSupplierDto`, `CreatePurchaseOrderDto` (ดัดแปลงจาก `ReceiveGoodsDto` เดิม)
- [ ] เพิ่ม methods ใน `PosService` สำหรับ CRUD `Supplier`
- [ ] สร้าง endpoint `/pos/purchase-order` เพื่อรองรับการสั่งซื้อเข้าคลัง โดย Logic จะสร้างเอกสาร `PurchaseOrder` ก่อน และเชื่อมไปยังการสร้าง Inventory Transaction `IN` และบวกสต็อก
- [ ] เพิ่ม/ปรับปรุง Unit Test ที่เกี่ยวข้องใน `pos.service.spec.ts`

## R2.4 — Order API & Checkout Refactor

- [ ] ปรับปรุง `CheckoutDto` ให้มี `paymentMethod`, `discountAmount`, `cashierId`
- [ ] แก้ไข method `checkout()` ใน `PosService` ให้ครอบคลุมการ:
  - คำนวณราคาสินค้าจาก `retailPrice` เป็น `unitPrice` และ `subtotal`
  - สร้าง `Order` (คำนวณ `totalAmount`, `netAmount`)
  - สร้าง `OrderItem` ของแต่ละรายการ
  - ล็อกสต็อกและบันทึก Inventory และ Transaction `OUT` (ทั้งหมดนี้ต้องอยู่ภายใต้ DB Transaction เดียวกัน)
- [ ] เพิ่ม method `getOrders()`, `getOrderById()` พร้อมสร้าง Endpoints ที่เกี่ยวข้อง
- [ ] อัปเดตและเพิ่ม Unit Test สำหรับ `checkout()` แบบใหม่

## R2.5 — Documentation & HTTP Client

- [ ] อัปเดตสคริปต์ `http/pos.http` ทดสอบการทำงานของทุก Endpoint 
- [ ] อัปเดตเอกสาร `.agents/references/pos-api.md` ให้เป็นปัจจุบัน อธิบาย payload และ response ที่เปลี่ยนไป

## R2.6 — Verification

- [ ] รัน `npm run build` ตรวจสอบ Type Safety
- [ ] รัน `npx jest` เพื่อยืนยันว่า Unit Test ทั้งหมด 100% Passes
- [ ] รัน lint สำหรับไฟล์ที่เปลี่ยนแปลง
- [ ] สร้าง commit message ตามข้อกำหนด
