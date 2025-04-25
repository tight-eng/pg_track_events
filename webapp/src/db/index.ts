// src/db.ts
// import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// config({ path: ".env.local" });

// const sql = neon(process.env.DATABASE_URL!);
// export const db = drizzle({ client: sql, logger: process.env.DB_LOGGING === "true" });

import { drizzle } from 'drizzle-orm/neon-serverless';
config({ path: ".env.local" });

// For Node.js - make sure to install the 'ws' and 'bufferutil' packages
import ws from 'ws';
export const db = drizzle({
  connection: process.env.DATABASE_URL!,
  logger: process.env.DB_LOGGING === "true",
  ws: ws,
});

import { PgTransaction } from 'drizzle-orm/pg-core';
import { NeonQueryResultHKT } from 'drizzle-orm/neon-serverless';

export type DB = typeof db;
export type DBTransaction = PgTransaction<NeonQueryResultHKT>;

export * from './schema/core'

