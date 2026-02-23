import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { StorageService } from './storage.service';

@Module({
    controllers: [FeedbackController],
    providers: [FeedbackService, StorageService],
    exports: [FeedbackService],
})
export class FeedbackModule { }
