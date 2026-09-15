import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_PENDING_PASSWORD_KEY, IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard global: o acesso ao sistema é restrito à Equipa de TI (TR §14),
 * por isso todas as rotas exigem sessão excepto as marcadas com @Public().
 * Enquanto a palavra-passe temporária não for alterada só são permitidas as
 * rotas marcadas com @AllowPendingPassword().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const { user } = context.switchToHttp().getRequest();
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets);
    if (user?.mustChangePassword && !allowPending) {
      throw new ForbiddenException('Altere a palavra-passe temporária antes de continuar');
    }
    return true;
  }
}
