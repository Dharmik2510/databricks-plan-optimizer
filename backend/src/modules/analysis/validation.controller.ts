// backend/src/modules/analysis/validation.controller.ts
// Controller for physical plan validation endpoints

import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidatePlanDto, ValidationResult } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('analyses')
@UseGuards(JwtAuthGuard)
export class ValidationController {
    constructor(private readonly validationService: ValidationService) { }

    /**
     * Validate a physical plan before analysis
     * POST /api/v1/analyses/validate
     */
    @Post('validate')
    @HttpCode(HttpStatus.OK)
    async validatePlan(
        @CurrentUser() user: CurrentUserData,
        @Body() dto: ValidatePlanDto,
    ): Promise<ValidationResult> {
        return this.validationService.validatePhysicalPlan(dto.planText, user.id);
    }

    /**
     * Quick heuristic validation (no AI, instant response)
     * POST /api/v1/analyses/validate/quick
     */
    @Post('validate/quick')
    @HttpCode(HttpStatus.OK)
    async quickValidate(
        @Body() dto: ValidatePlanDto,
    ): Promise<{ likely_valid: boolean; hints: string[] }> {
        return this.validationService.quickValidate(dto.planText);
    }
}
