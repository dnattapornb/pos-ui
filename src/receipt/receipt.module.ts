import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Receipt, ReceiptSchema } from './receipt.schema';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';
import { LineModule } from '../line/line.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Receipt.name, schema: ReceiptSchema }]),
        forwardRef(() => LineModule),
    ],
    controllers: [ReceiptController],
    providers: [ReceiptService],
    exports: [ReceiptService],
})
export class ReceiptModule { }
