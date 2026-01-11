import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators';
import { UserRole } from '@prisma/client';
import { OrgConnectionsService } from './org-connections.service';
import {
  CreateOrgConnectionDto,
  UpdateOrgConnectionDto,
  ValidateOrgConnectionDto,
} from './dto';
import { setRequestContextFeature } from '../../common/middleware/request-context.middleware';

@Controller('org/connections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class OrgConnectionsController {
  constructor(private readonly orgConnectionsService: OrgConnectionsService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserData) {
    setRequestContextFeature('org-connections');
    return this.orgConnectionsService.listConnections(user.id, user.orgId);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateOrgConnectionDto,
  ) {
    setRequestContextFeature('org-connections');
    return this.orgConnectionsService.createConnection(user.id, user.orgId, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateOrgConnectionDto,
  ) {
    setRequestContextFeature('org-connections');
    return this.orgConnectionsService.updateConnection(user.id, user.orgId, id, dto);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ValidateOrgConnectionDto,
  ) {
    setRequestContextFeature('org-connections');
    return this.orgConnectionsService.validateConnection(user.id, user.orgId, dto.connectionId);
  }
}
