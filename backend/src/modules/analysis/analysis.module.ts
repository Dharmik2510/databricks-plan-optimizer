import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { ValidationController } from './validation.controller';
import { AnalysisService } from './analysis.service';
import { ValidationService } from './validation.service';
import { GeminiModule } from '../../integrations/gemini/gemini.module';

@Module({
  imports: [GeminiModule],
  controllers: [AnalysisController, ValidationController],
  providers: [AnalysisService, ValidationService],
  exports: [AnalysisService, ValidationService],
})
export class AnalysisModule { }

