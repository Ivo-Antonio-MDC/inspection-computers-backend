export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    name: process.env.DB_NAME ?? 'inspeccao_computadores',
    ssl: process.env.DB_SSL === 'true',
  },

  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET ?? '',
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET ?? '',
    refreshExpiresDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '7', 10),
  },
});
