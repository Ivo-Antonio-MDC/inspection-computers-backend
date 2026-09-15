import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Double-submit cookie: as rotas que dependem do cookie de refresh exigem que o
 * cabeçalho X-CSRF-Token coincida com o cookie csrf_token (não HttpOnly).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieToken = req.cookies?.['csrf_token'] as string | undefined;
    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token em falta');
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    if (cookieBuf.length !== headerBuf.length || !timingSafeEqual(cookieBuf, headerBuf)) {
      throw new ForbiddenException('CSRF token inválido');
    }
    return true;
  }
}
