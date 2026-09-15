import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { Department } from '../departments/entities/department.entity';
import { Location } from '../locations/entities/location.entity';
import { InspectionRecord } from '../records/entities/inspection-record.entity';
import { User } from '../users/entities/user.entity';
import { CollaboratorsService } from './collaborators.service';
import { CollaboratorQueryDto, CreateCollaboratorDto, UpdateCollaboratorDto } from './dto/collaborator.dto';
import { Collaborator } from './entities/collaborator.entity';

@ApiTags('Colaboradores')
@ApiBearerAuth('JWT')
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly service: CollaboratorsService) {}

  @Get()
  @ApiOperation({ summary: 'Pesquisar colaboradores por nome, departamento e localização' })
  findAll(@Query() q: CollaboratorQueryDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCollaboratorDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.create(dto, u.id, clientIp(req));
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollaboratorDto,
    @CurrentUser() u: User,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, u.id, clientIp(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.remove(id, u.id, clientIp(req));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Collaborator, Department, Location, InspectionRecord])],
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService],
})
export class CollaboratorsModule {}
