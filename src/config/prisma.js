import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Singleton: `node --watch` reinicia el modulo en cada cambio, y sin esto cada
// reload abriria un pool de conexiones nuevo hasta agotar los slots de Postgres.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ['query', 'warn', 'error'] : ['error'],
  });

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
