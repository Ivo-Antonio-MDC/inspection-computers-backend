import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuditService, diff } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AuditAction, UserRole } from '../common/enums';
import { InspectionRecord } from '../records/entities/inspection-record.entity';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  findAll() {
    return this.repo.find({ order: { isActive: 'DESC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilizador não encontrado');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string, ip: string | null) {
    await this.ensureEmailFree(dto.email);
    const user = await this.repo.save(
      this.repo.create({
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: await bcrypt.hash(dto.password, 12),
        mustChangePassword: true,
      }),
    );
    await this.audit.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entity: 'user',
      entityId: user.id,
      summary: `Utilizador criado: ${user.name} (${user.role})`,
      ip,
    });
    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, ip: string | null) {
    const user = await this.findOne(id);
    if (id === actorId && (dto.isActive === false || (dto.role && dto.role !== user.role))) {
      throw new BadRequestException('Não pode desactivar nem alterar o perfil da sua própria conta');
    }
    if (dto.email && dto.email !== user.email) await this.ensureEmailFree(dto.email);

    const before = { ...user };
    Object.assign(user, dto);
    await this.repo.save(user);
    if (dto.isActive === false) await this.auth.revokeAll(id);

    await this.audit.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: id,
      summary: `Utilizador actualizado: ${user.name}`,
      changes: diff(before, user as unknown as Record<string, unknown>, ['name', 'email', 'role', 'isActive']),
      ip,
    });
    return user;
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string, ip: string | null) {
    const user = await this.findOne(id);
    await this.repo.update(id, {
      passwordHash: await bcrypt.hash(dto.password, 12),
      mustChangePassword: true,
    });
    await this.auth.revokeAll(id);
    await this.audit.log({
      userId: actorId,
      action: AuditAction.PASSWORD_CHANGE,
      entity: 'user',
      entityId: id,
      summary: `Palavra-passe redefinida para ${user.name}`,
      ip,
    });
    return { ok: true };
  }

  /**
   * Elimina a conta. Utilizadores que já registaram formulários não podem ser
   * eliminados (histórico da recolha) — nesse caso deve-se desactivar a conta.
   */
  async remove(id: string, actorId: string, ip: string | null) {
    const user = await this.findOne(id);
    if (id === actorId) throw new BadRequestException('Não pode eliminar a sua própria conta');

    const records = await this.repo.manager.count(InspectionRecord, { where: { createdById: id } });
    if (records > 0) {
      throw new ConflictException(
        `${user.name} registou ${records} formulário(s) e não pode ser eliminado — desactive a conta para lhe retirar o acesso`,
      );
    }
    if (user.role === UserRole.ADMIN && user.isActive) {
      const admins = await this.repo.count({ where: { role: UserRole.ADMIN, isActive: true } });
      if (admins <= 1) throw new BadRequestException('Não é possível eliminar o último administrador activo');
    }

    await this.auth.revokeAll(id);
    await this.repo.delete(id);
    await this.audit.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entity: 'user',
      entityId: id,
      summary: `Utilizador eliminado: ${user.name} (${user.email})`,
      ip,
    });
    return { ok: true };
  }

  private async ensureEmailFree(email: string) {
    if (await this.repo.exists({ where: { email } })) {
      throw new ConflictException('Já existe um utilizador com este email');
    }
  }
}
