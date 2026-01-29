import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { UpdateDataSourceDto } from './dto/update-datasource.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('datasources')
@UseGuards(JwtAuthGuard)
export class DataSourcesController {
  private readonly logger = new Logger(DataSourcesController.name);

  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createDataSourceDto: CreateDataSourceDto,
  ) {
    this.logger.log(
      `User ${user.id} creating data source: ${createDataSourceDto.name}`,
    );
    return this.dataSourcesService.create(user.id, createDataSourceDto);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.dataSourcesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dataSourcesService.findOne(user.id, id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDataSourceDto: UpdateDataSourceDto,
  ) {
    this.logger.log(`User ${user.id} updating data source: ${id}`);
    return this.dataSourcesService.update(user.id, id, updateDataSourceDto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    this.logger.log(`User ${user.id} deleting data source: ${id}`);
    await this.dataSourcesService.remove(user.id, id);
    return { success: true };
  }

  @Post('test-connection')
  async testConnection(
    @CurrentUser() user: any,
    @Body() testConnectionDto: TestConnectionDto,
  ) {
    this.logger.log(
      `User ${user.id} testing connection: ${testConnectionDto.connection_type}`,
    );
    return this.dataSourcesService.testConnection(user.id, testConnectionDto);
  }
}
