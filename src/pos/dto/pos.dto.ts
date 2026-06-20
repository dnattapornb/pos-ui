import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { UnitName } from '../enums/unit.enum';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class CreateProductUnitDto {
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsEnum(UnitName)
  unitName: UnitName;

  @IsNumber()
  @IsPositive()
  multiplier: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  retailPrice: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  wholesalePrice: number;
}

export class AddProductUnitDto extends CreateProductUnitDto {
  @IsNumber()
  @IsPositive()
  productId: number;
}

export class UpdateProductUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barcode?: string;

  @IsOptional()
  @IsEnum(UnitName)
  unitName?: UnitName;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  multiplier?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  retailPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(UnitName)
  baseUnitName: UnitName;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  categoryId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductUnitDto)
  units: CreateProductUnitDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(UnitName)
  baseUnitName?: UnitName;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductUnitDto)
  units?: CreateProductUnitDto[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}

export class PurchaseOrderItemDto {
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsNumber()
  @IsPositive()
  qty: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  supplierId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

export class CheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsNumber()
  @IsPositive()
  qty: number;
}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  referenceId?: string;
}
