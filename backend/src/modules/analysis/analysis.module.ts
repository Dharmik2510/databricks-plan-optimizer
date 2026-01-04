import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { ValidationController } from './validation.controller';
import { AnalysisService } from './analysis.service';
import { ValidationService } from './validation.service';
import { GeminiModule } from '../../integrations/gemini/gemini.module';
import { EventLogParser } from './event-log.parser';
import { Tier1ModelService } from './tier1-model.service';

@Module({
  imports: [GeminiModule],
  controllers: [AnalysisController, ValidationController],
  providers: [
    AnalysisService,
    ValidationService,
    EventLogParser,
    Tier1ModelService
  ],
  exports: [AnalysisService, ValidationService],
})
export class AnalysisModule { }

