import {
  BadRequestException,
  Controller,
  Get,
  Module,
  ParseUUIDPipe,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { clientIp } from '../common/utils/request';
import { Inspection } from '../inspections/entities/inspection.entity';
import { EquipmentQueryDto } from '../records/dto/record.dto';
import { RecordsModule } from '../records/records.module';
import { User } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';

class ExportQueryDto extends EquipmentQueryDto {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

@ApiTags('Relatórios e exportação')
@ApiBearerAuth('JWT')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Indicadores consolidados de uma inspecção' })
  summary(@Query('inspectionId', ParseUUIDPipe) inspectionId: string) {
    return this.reports.summary(inspectionId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar para Excel (.xlsx) ou CSV — aceita os filtros da listagem de equipamentos' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'csv'], required: false })
  async export(@Query() q: ExportQueryDto, @CurrentUser() user: User, @Req() req: Request) {
    const { format = 'xlsx', ...filters } = q;
    if (!filters.inspectionId) throw new BadRequestException('Seleccione a inspecção a exportar');
    const file = await this.reports.exportFile(
      { ...filters, inspectionId: filters.inspectionId },
      format,
      user,
      clientIp(req),
    );
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
      length: file.buffer.length,
    });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Inspection]), RecordsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
