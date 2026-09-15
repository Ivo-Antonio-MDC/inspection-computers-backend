import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const WEAK_SECRETS = new Set([
  'change_me_min_32_chars_access_secret_xx',
  'change_me_min_32_chars_refresh_secret_x',
]);

/** Em produção recusa arrancar com segredos JWT fracos; em desenvolvimento apenas avisa. */
function validateSecrets(config: ConfigService, nodeEnv: string) {
  const problems: string[] = [];
  for (const [key, env] of [
    ['jwt.accessSecret', 'ACCESS_TOKEN_SECRET'],
    ['jwt.refreshSecret', 'REFRESH_TOKEN_SECRET'],
  ]) {
    const value = config.get<string>(key) ?? '';
    if (!value || WEAK_SECRETS.has(value)) problems.push(`${env} não definido ou com valor de exemplo`);
    else if (value.length < 32) problems.push(`${env} tem menos de 32 caracteres`);
  }
  if (!config.get<string>('jwt.accessSecret') || !config.get<string>('jwt.refreshSecret')) {
    throw new Error(`[Segurança] ${problems.join('; ')}`);
  }
  if (problems.length === 0) return;
  if (nodeEnv === 'production') throw new Error(`[Segurança] ${problems.join('; ')}`);
  new Logger('Security').warn(`${problems.join('; ')} — corrigir antes de ir para produção`);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';
  validateSecrets(config, nodeEnv);

  const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  const port = config.get<number>('port') ?? 4000;
  const origins = (config.get<string>('frontendUrl') ?? 'http://localhost:3000').split(',').map((s) => s.trim());

  // Atrás de proxy (Next.js rewrites / Nginx): usa X-Forwarded-For para o IP real
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(helmet({ hsts: { maxAge: 31_536_000, includeSubDomains: true } }));
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  if (nodeEnv !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Inspecção de Computadores — API')
      .setDescription('MD Consultores · Sistema de Recolha de Dados para Inspecção de Computadores')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .build();
    SwaggerModule.setup(`${apiPrefix}/docs`, app, SwaggerModule.createDocument(app, doc));
  }

  app.enableShutdownHooks();
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API → http://localhost:${port}/${apiPrefix}`);
  if (nodeEnv !== 'production') logger.log(`Swagger → http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
