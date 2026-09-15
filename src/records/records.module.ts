import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { Inspection } from '../inspections/entities/inspection.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateRecordDto,
  EquipmentQueryDto,
  RecordQueryDto,
  ReviewRecordDto,
  UpdateRecordDto,
  ValidateRecordDto,
} from './dto/record.dto';
import { Equipment } from './entities/equipment.entity';
import { InspectionRecord } from './entities/inspection-record.entity';
import { EquipmentService } from './equipment.service';
import { RecordsService } from './records.service';

@ApiTags('Formulários de inspecção')
@ApiBearerAuth('JWT')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar, pesquisar e filtrar formulários' })
  findAll(@Query() q: RecordQueryDto) {
    return this.records.findAll(q);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Formulário existente de um colaborador numa inspecção (ou null)' })
  lookup(
    @Query('inspectionId', ParseUUIDPipe) inspectionId: string,
    @Query('collaboratorId', ParseUUIDPipe) collaboratorId: string,
  ) {
    return this.records.findByCollaborator(inspectionId, collaboratorId);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validação final (completude, formatos, duplicados) sem gravar' })
  validate(@Body() dto: ValidateRecordDto) {
    return this.records.dryRun(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.records.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar formulário (rascunho ou submissão)' })
  create(@Body() dto: CreateRecordDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.records.create(dto, { user, ip: clientIp(req) });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar formulário e respectivos equipamentos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecordDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.records.update(id, dto, { user, ip: clientIp(req) });
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar o formulário ou pedir correcção (administrador)' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRecordDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.records.review(id, dto, { user, ip: clientIp(req) });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.records.remove(id, { user, ip: clientIp(req) });
  }
}

@ApiTags('Equipamentos')
@ApiBearerAuth('JWT')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  @ApiOperation({ summary: 'Pesquisar equipamentos por tipo, estado, localização, problemas…' })
  findAll(@Query() q: EquipmentQueryDto) {
    return this.service.findAll(q);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([InspectionRecord, Equipment, Inspection, Collaborator])],
  controllers: [RecordsController, EquipmentController],
  providers: [RecordsService, EquipmentService],
  exports: [EquipmentService],
})
export class RecordsModule {}
