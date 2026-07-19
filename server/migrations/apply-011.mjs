// Runner for 011_user_status.sql. Run from app root:
//   node server/migrations/apply-011.mjs
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
process.loadEnvFile?.(new URL("./.env", `file://${process.cwd()}/`));
const sql = await readFile(new URL("./server/migrations/011_user_status.sql", `file://${process.cwd()}/`), "utf8");
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, multipleStatements: true,
});
await conn.query(sql);
const [c] = await conn.query("SHOW COLUMNS FROM users LIKE 'status'");
console.log("users.status column:", c.length === 1);
await conn.end();
