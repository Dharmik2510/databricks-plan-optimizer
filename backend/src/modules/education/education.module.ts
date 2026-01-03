import { Module } from '@nestjs/common';
import { EducationController } from './education.controller';
import { EducationService } from './education.service';
import { GeminiModule } from '../../integrations/gemini/gemini.module';

@Module({
    imports: [GeminiModule],
    controllers: [EducationController],
    providers: [EducationService],
    exports: [EducationService],
})
export class EducationModule { }
