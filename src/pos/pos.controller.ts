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
  ReceiveGoodsDto,
  CheckoutDto,
  CreateProductDto,
  UpdateProductDto,
  AddProductUnitDto,
  UpdateProductUnitDto,
  CreateCategoryDto,
  UpdateCategoryDto,
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

  @Post('seed')
  seedProducts() {
    return this.posService.seedProducts();
  }

  @Post('inventory/receive')
  receiveGoods(@Body() dto: ReceiveGoodsDto) {
    return this.posService.receiveGoods(dto);
  }

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return this.posService.checkout(dto);
  }
}
