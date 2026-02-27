import { Module, forwardRef } from '@nestjs/common';
import { LineController } from './line.controller';
import { LineService } from './line.service';
import { OcrModule } from '../ocr/ocr.module';
import { ReceiptModule } from '../receipt/receipt.module';

@Module({
  imports: [OcrModule, forwardRef(() => ReceiptModule)],
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService],
})
export class LineModule { }
