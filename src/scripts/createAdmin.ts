import "dotenv/config";
import bcrypt from "bcrypt";
import { db as pool, initDb } from "../db/pool";

async function main() {
  await initDb();
  const username = "admin";          // change if you want
  const password = "Strong#@admin!!pass123";       // change to a strong one

  try {
    // 1. Check if user already exists
    const existing = await pool.query(
      "SELECT id FROM app_user WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      console.log(`User '${username}' already exists with id:`, existing.rows[0].id);
      process.exit(0);
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insert admin user
    const result = await pool.query(
      `
      INSERT INTO app_user (username, password_hash, role)
      VALUES ($1, $2, 'ADMIN')
      RETURNING id, username, role, created_at;
      `,
      [username, passwordHash]
    );

    console.log("✅ Admin user created:");
    console.log(result.rows[0]);
    console.log(`\nLogin with: username='${username}' password='${password}'`);
  } catch (err) {
    console.error("Error creating admin user:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();