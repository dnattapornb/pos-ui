import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receipt } from './receipt.entity';
import { ReceiptItem } from './receipt-item.entity';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { LineModule } from '../line/line.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Receipt, ReceiptItem]),
        forwardRef(() => LineModule),
    ],
    controllers: [ReceiptController],
    providers: [ReceiptService],
    exports: [ReceiptService],
})
export class ReceiptModule { }
