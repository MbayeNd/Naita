import dotenv from 'dotenv';
dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  // Short-lived on purpose — the refresh token (httpOnly cookie) is what carries
  // a session across hours, not this. ACCESS_TOKEN_EXPIRES_IN is the current name;
  // JWT_EXPIRES_IN is honoured too so an existing deployment's env vars still work.
  jwtExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '15m',
  refreshTokenExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@naita.lk',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
};

export const isProd = env.nodeEnv === 'production';


