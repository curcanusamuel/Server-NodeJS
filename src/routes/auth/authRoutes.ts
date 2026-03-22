import { Router } from "express";
import { db as pool } from "../../db/pool";
import bcrypt from "bcrypt";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, role, is_active FROM app_user WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Optional: update last_login_at
    await pool.query(
      "UPDATE app_user SET last_login_at = NOW() WHERE id = $1",
      [user.id]
    );

    // Save minimal info in session
    (req.session as any).user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    res.json({
      message: "Logged in",
        role: user.role,
      username: user.username,
      id: user.id
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get("/me", (req, res) => {
  const user = (req.session as any).user;

  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user,
  });
});

export default router