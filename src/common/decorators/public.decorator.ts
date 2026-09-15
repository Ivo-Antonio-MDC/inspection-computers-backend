import { SetMetadata } from '@nestjs/common';

/** Marca uma rota como pública — o JwtAuthGuard global deixa-a passar. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Rota acessível mesmo antes de alterar a palavra-passe temporária. */
export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
