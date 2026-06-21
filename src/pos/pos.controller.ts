import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { PosService } from './pos.service';
import {
  CheckoutDto,
  CreateProductDto,
  UpdateProductDto,
  AddProductUnitDto,
  UpdateProductUnitDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
} from './dto/pos.dto';

@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('categories')
  async getAllCategories() {
    return this.posService.getAllCategories();
  }

  @Get('category/:id')
  async getCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getCategoryById(id);
  }

  @Post('category')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.posService.createCategory(dto);
  }

  @Put('category/:id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.posService.updateCategory(id, dto);
  }

  @Delete('category/:id')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.posService.deleteCategory(id);
  }

  @Get('products')
  async getAllProducts() {
    return this.posService.getAllProducts();
  }

  @Get('barcode/:barcode')
  async lookupBarcode(@Param('barcode') barcode: string) {
    return this.posService.lookupBarcode(barcode);
  }

  @Get('product/unit/:id')
  async getProductUnitById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getProductUnitById(id);
  }

  @Post('product/unit')
  async createProductUnit(@Body() dto: AddProductUnitDto) {
    return this.posService.createProductUnit(dto);
  }

  @Put('product/unit/:id')
  async updateProductUnit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductUnitDto,
  ) {
    return this.posService.updateProductUnit(id, dto);
  }

  @Delete('product/unit/:id')
  async deleteProductUnit(@Param('id', ParseIntPipe) id: number) {
    return this.posService.deleteProductUnit(id);
  }

  @Get('product/:id')
  async getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getProductById(id);
  }

  @Post('product')
  async createProduct(@Body() dto: CreateProductDto) {
    return this.posService.createProduct(dto);
  }

  @Put('product/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.posService.updateProduct(id, dto);
  }

  @Delete('product/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.posService.deleteProduct(id);
  }

  @Get('suppliers')
  async getAllSuppliers() {
    return this.posService.getAllSuppliers();
  }

  @Get('supplier/:id')
  async getSupplierById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getSupplierById(id);
  }

  @Post('supplier')
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.posService.createSupplier(dto);
  }

  @Put('supplier/:id')
  async updateSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.posService.updateSupplier(id, dto);
  }

  @Delete('supplier/:id')
  async deleteSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.posService.deleteSupplier(id);
  }

  @Post('purchase-order')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.posService.createPurchaseOrder(dto);
  }

  @Post('seed')
  seedProducts() {
    return this.posService.seedProducts();
  }

  @Get('orders')
  async getOrders() {
    return this.posService.getOrders();
  }

  @Get('order/:id')
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.posService.getOrderById(id);
  }

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.posService.checkout(dto);
  }
}
