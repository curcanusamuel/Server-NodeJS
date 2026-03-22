import { Router } from "express";
import bcrypt from "bcrypt";
import { db as pool } from "../../db/pool";

const router = Router();

const ensureClient = (req: any, res: any) => {
  const sessionUser = req.session?.user;
  if (!sessionUser || sessionUser.role !== "DOCTOR") {
    res.status(403).json({ error: "Acces interzis" });
    return null;
  }
  return sessionUser;
};

const ensureSettingsRow = async (userId: number) => {
  await pool.query(
    `
      INSERT INTO client_settings (user_id, dark_mode)
      VALUES ($1, false)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
};

router.get("/settings", async (req, res) => {
  try {
    const sessionUser = ensureClient(req, res);
    if (!sessionUser) return;

    await ensureSettingsRow(sessionUser.id);

    const result = await pool.query(
      "SELECT dark_mode FROM client_settings WHERE user_id = $1",
      [sessionUser.id]
    );

    const darkMode = result.rows[0]?.dark_mode ?? false;
    res.json({ darkMode });
  } catch (err) {
    console.error("GET /api/client/settings error:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const sessionUser = ensureClient(req, res);
    if (!sessionUser) return;

    const { darkMode } = req.body as { darkMode?: boolean };
    const desired = Boolean(darkMode);

    const result = await pool.query(
      `
        INSERT INTO client_settings (user_id, dark_mode)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET dark_mode = EXCLUDED.dark_mode, updated_at = NOW()
        RETURNING dark_mode
      `,
      [sessionUser.id, desired]
    );

    res.json({ darkMode: result.rows[0]?.dark_mode ?? desired });
  } catch (err) {
    console.error("POST /api/client/settings error:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const sessionUser = ensureClient(req, res);
    if (!sessionUser) return;

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Completează toate câmpurile." });
    }

    const userResult = await pool.query(
      "SELECT password_hash FROM app_user WHERE id = $1",
      [sessionUser.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "Utilizator inexistent." });
    }

    const user = userResult.rows[0];
    const matches = await bcrypt.compare(currentPassword, user.password_hash);

    if (!matches) {
      return res.status(401).json({ error: "Parola curentă este incorectă." });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE app_user SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hash, sessionUser.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/client/change-password error:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.post("/change-username", async (req, res) => {
  try {
    const sessionUser = ensureClient(req, res);
    if (!sessionUser) return;

    const { username } = req.body as { username?: string };

    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Numele de utilizator este obligatoriu." });
    }

    const trimmed = username.trim();

    const existsResult = await pool.query(
      "SELECT id FROM app_user WHERE username = $1 AND id <> $2",
      [trimmed, sessionUser.id]
    );

    if ((existsResult.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "Numele de utilizator este deja folosit." });
    }

    const updated = await pool.query(
      "UPDATE app_user SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING username",
      [trimmed, sessionUser.id]
    );

    (req.session as any).user.username = trimmed;

    res.json({ username: updated.rows[0]?.username ?? trimmed });
  } catch (err) {
    console.error("POST /api/client/change-username error:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;