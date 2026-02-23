import { Module } from '@nestjs/common';
import { DbrController } from './dbr.controller';
import { DbrService } from './dbr.service';

@Module({
    controllers: [DbrController],
    providers: [DbrService],
})
export class DbrModule { }
