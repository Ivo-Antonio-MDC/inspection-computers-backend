import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums';
import { User } from '../users/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { Session } from './entities/session.entity';
import { AccessTokenPayload } from './strategies/jwt.strategy';

interface RefreshPayload {
  sub: string;
  sid: string;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'mustChangePassword' | 'lastLoginAt'
>;

// Hash fictício usado quando o email não existe, para não revelar contas por tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', 12);

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Email ou palavra-passe incorrectos');
    if (!user.isActive) throw new UnauthorizedException('Conta desactivada. Contacte o administrador.');

    user.lastLoginAt = new Date();
    await this.users.update(user.id, { lastLoginAt: user.lastLoginAt });

    const result = await this.issueTokens(user, meta);
    await this.audit.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'user',
      entityId: user.id,
      summary: 'Início de sessão',
      ip: meta.ip,
    });
    return result;
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthResult> {
    const payload = await this.verifyRefresh(rawToken);
    const session = await this.sessions.findOne({
      where: { id: payload.sid, userId: payload.sub, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!session || session.tokenHash !== sha256(rawToken)) {
      // Reutilização de um token já rodado: revoga todas as sessões do utilizador por precaução.
      if (session) await this.revokeAll(payload.sub);
      throw new UnauthorizedException('Sessão expirada. Inicie sessão novamente.');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Conta desactivada');

    const refreshToken = this.signRefresh(user.id, session.id);
    session.tokenHash = sha256(refreshToken);
    session.expiresAt = this.refreshExpiry();
    session.ip = meta.ip;
    session.userAgent = meta.userAgent?.slice(0, 255) ?? null;
    await this.sessions.save(session);

    return { accessToken: this.signAccess(user), refreshToken, user: toPublicUser(user) };
  }

  async logout(rawToken: string | undefined, ip: string | null): Promise<{ ok: true }> {
    if (rawToken) {
      try {
        const payload = await this.verifyRefresh(rawToken);
        await this.sessions.update({ id: payload.sid }, { revokedAt: new Date() });
        await this.audit.log({
          userId: payload.sub,
          action: AuditAction.LOGOUT,
          entity: 'user',
          entityId: payload.sub,
          summary: 'Fim de sessão',
          ip,
        });
      } catch {
        /* token inválido — nada a revogar */
      }
    }
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ip: string | null) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();

    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('A palavra-passe actual está incorrecta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova palavra-passe deve ser diferente da actual');
    }

    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(dto.newPassword, 12),
      mustChangePassword: false,
    });
    await this.audit.log({
      userId,
      action: AuditAction.PASSWORD_CHANGE,
      entity: 'user',
      entityId: userId,
      summary: 'Alteração da palavra-passe',
      ip,
    });

    const updated = await this.users.findOneByOrFail({ id: userId });
    return { accessToken: this.signAccess(updated), user: toPublicUser(updated) };
  }

  async revokeAll(userId: string, exceptSessionId?: string) {
    await this.sessions.update(
      { userId, revokedAt: IsNull(), ...(exceptSessionId ? { id: Not(exceptSessionId) } : {}) },
      { revokedAt: new Date() },
    );
  }

  refreshTtlMs(): number {
    return this.config.get<number>('jwt.refreshExpiresDays', 7) * 24 * 60 * 60 * 1000;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async issueTokens(user: User, meta: RequestMeta): Promise<AuthResult> {
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: 'pending',
        expiresAt: this.refreshExpiry(),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      }),
    );
    const refreshToken = this.signRefresh(user.id, session.id);
    await this.sessions.update(session.id, { tokenHash: sha256(refreshToken) });
    return { accessToken: this.signAccess(user), refreshToken, user: toPublicUser(user) };
  }

  private signAccess(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpiresIn', '15m'),
    });
  }

  private signRefresh(userId: string, sessionId: string): string {
    const payload: RefreshPayload = { sub: userId, sid: sessionId };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: `${this.config.get<number>('jwt.refreshExpiresDays', 7)}d`,
    });
  }

  private async verifyRefresh(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Inicie sessão novamente.');
    }
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlMs());
  }
}
