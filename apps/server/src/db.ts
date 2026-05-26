import { Pool } from 'pg';

export const databaseUrl = process.env.DATABASE_URL ?? '';
export const useDatabase = databaseUrl.length > 0;
export const pool = useDatabase ? new Pool({ connectionString: databaseUrl }) : null;
