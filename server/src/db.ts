import { createPool, type Pool, type PoolOptions } from "mysql2/promise";

let pool: Pool | undefined;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required database environment variable: ${name}`);
  }

  return value;
}

function getDatabaseOptions(): PoolOptions {
  const port = Number.parseInt(process.env.DB_PORT ?? "3306", 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("DB_PORT must be a positive integer");
  }

  if ((process.env.DB_SSL ?? "true").toLowerCase() !== "true") {
    throw new Error("DB_SSL must be true for TiDB Cloud");
  }

  const options: PoolOptions = {
    host: getRequiredEnv("DB_HOST"),
    port,
    user: getRequiredEnv("DB_USER"),
    password: getRequiredEnv("DB_PASSWORD"),
    database: getRequiredEnv("DB_NAME"),
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  };

  options.ssl = { rejectUnauthorized: true };

  return options;
}

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = createPool(getDatabaseOptions());
  }

  return pool;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getDatabasePool().query("SELECT 1");
}
