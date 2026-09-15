import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import configuration from './config/configuration';
import { ENTITIES } from './database/entities';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { InspectionsModule } from './inspections/inspections.module';
import { LocationsModule } from './locations/locations.module';
import { RecordsModule } from './records/records.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        entities: ENTITIES,
        synchronize: false,
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: true,
        logging: config.get<string>('nodeEnv') === 'development' ? ['error', 'warn', 'migration'] : ['error'],
      }),
    }),

    // Limite global por IP (o login tem um limite próprio mais restrito)
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }] }),

    AuditModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    DepartmentsModule,
    InspectionsModule,
    CollaboratorsModule,
    RecordsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
