// Runner for 010_push_subscriptions.sql. Run from app root:
//   node server/migrations/apply-010.mjs
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
process.loadEnvFile?.(new URL("./.env", `file://${process.cwd()}/`));
const sql = await readFile(new URL("./server/migrations/010_push_subscriptions.sql", `file://${process.cwd()}/`), "utf8");
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, multipleStatements: true,
});
await conn.query(sql);
const [t] = await conn.query("SHOW TABLES LIKE 'push_subscriptions'");
console.log("push_subscriptions table:", t.length === 1);
await conn.end();
