import { PrismaClient } from '@prisma/client';

// Global caching of Prisma Client to avoid exhausting database connections in development hot-reloads
declare global {
  var _prismaClient: PrismaClient | undefined;
}

export const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER || 'ai_studio_app_user';
  const password = process.env.SQL_PASSWORD || '';
  const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';

  if (!host) {
    console.warn('SQL_HOST is not set. Defaulting to localhost:5432.');
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/${dbName}`;
  }

  // If host is a Unix socket path (e.g. /app/cloudsql/...)
  if (host.startsWith('/')) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${encodeURIComponent(host)}`;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
};

export const getPrismaClient = (): PrismaClient => {
  if (!global._prismaClient) {
    const datasourceUrl = getDatabaseUrl();
    global._prismaClient = new PrismaClient({
      datasourceUrl,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return global._prismaClient;
};

export const prisma = getPrismaClient();
export default prisma;
