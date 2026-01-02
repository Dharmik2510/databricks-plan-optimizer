import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { StorageService } from './storage.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FeedbackController],
    providers: [FeedbackService, StorageService],
    exports: [FeedbackService],
})
export class FeedbackModule { }
