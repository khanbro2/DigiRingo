// Runner for 013_device_tokens.sql. Run from app root:
//   node server/migrations/apply-013.mjs
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
process.loadEnvFile?.(new URL("./.env", `file://${process.cwd()}/`));
const sql = await readFile(new URL("./server/migrations/013_device_tokens.sql", `file://${process.cwd()}/`), "utf8");
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, multipleStatements: true,
});
await conn.query(sql);
const [t] = await conn.query("SHOW TABLES LIKE 'device_tokens'");
console.log("device_tokens table:", t.length === 1);
await conn.end();
