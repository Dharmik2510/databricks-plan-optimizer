import { Module } from '@nestjs/common';
import { DbrController } from './dbr.controller';
import { DbrService } from './dbr.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [DbrController],
    providers: [DbrService, PrismaService],
})
export class DbrModule { }
