import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AllowPendingPassword, Public } from '../common/decorators/public.decorator';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { clientIp } from '../common/utils/request';
import { User } from '../users/entities/user.entity';
import { AuthService, toPublicUser } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Início de sessão — access token no body, refresh token em cookie HttpOnly' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.meta(req));
    this.setAuthCookies(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renovar o access token com o cookie de refresh (rotação)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
    try {
      const result = await this.auth.refresh(raw, this.meta(req));
      this.setAuthCookies(res, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user };
    } catch (err) {
      this.clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Terminar sessão — revoga a sessão e limpa os cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    this.clearAuthCookies(res);
    return this.auth.logout(raw, clientIp(req));
  }

  @Get('me')
  @AllowPendingPassword()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Dados do utilizador autenticado' })
  me(@CurrentUser() user: User) {
    return toPublicUser(user);
  }

  @Patch('password')
  @AllowPendingPassword()
  @ApiBearerAuth('JWT')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Alterar a própria palavra-passe' })
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.auth.changePassword(user.id, dto, clientIp(req));
  }

  // ── Cookies ────────────────────────────────────────────────────────────────

  private meta(req: Request) {
    return { ip: clientIp(req), userAgent: (req.headers['user-agent'] as string) ?? null };
  }

  private cookieOptions(httpOnly: boolean) {
    return {
      httpOnly,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: this.auth.refreshTtlMs(),
    };
  }

  private setAuthCookies(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(true));
    res.cookie(CSRF_COOKIE, randomBytes(32).toString('hex'), this.cookieOptions(false));
  }

  private clearAuthCookies(res: Response) {
    const { maxAge: _ignored, ...opts } = this.cookieOptions(true);
    res.clearCookie(REFRESH_COOKIE, opts);
    res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
  }
}
