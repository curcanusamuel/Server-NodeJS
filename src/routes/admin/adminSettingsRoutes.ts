import { Router } from "express";
import { requireAdmin } from "../../middleware/auth";
import { db as pool } from "../../db/pool";
import bcrypt from "bcrypt";
import { updateSettingsInMemory } from "../../settingsService";

const router = Router();

router.get("/settings", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT key, value FROM app_settings");
        const map = new Map<string, string>(
            result.rows.map((r: any) => [r.key, r.value])
        );

        const settings = {
            darkMode: map.get("dark_mode_enabled") === "true",
            sessionTimeoutMinutes: Number(map.get("session_timeout_minutes") || 120),
            defaultUserRole: (map.get("default_user_role") || "DOCTOR") as "ADMIN" | "DOCTOR",
            allowAccountCreation: map.get("allow_account_creation") === "true",
        };

        res.json(settings);
    } catch (err) {
        console.error("Error reading settings:", err);
        res.status(500).json({ error: "Eroare internă de server" });
    }
});

router.post("/settings", requireAdmin, async (req, res) => {
    try {
        const {
            darkMode,
            sessionTimeoutMinutes,
            defaultUserRole,
            allowAccountCreation,
        } = req.body as {
            darkMode: boolean;
            sessionTimeoutMinutes: number;
            defaultUserRole: "ADMIN" | "DOCTOR";
            allowAccountCreation: boolean;
        };

        const entries: [string, string][] = [
            ["dark_mode_enabled", darkMode ? "true" : "false"],
            ["session_timeout_minutes", String(sessionTimeoutMinutes)],
            ["default_user_role", defaultUserRole],
            ["allow_account_creation", allowAccountCreation ? "true" : "false"],
        ];

        for (const [key, value] of entries) {
            await pool.query(
                `
        INSERT INTO app_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `,
                [key, value]
            );
        }

        //update the in-memory cache
        updateSettingsInMemory({
            darkMode,
            sessionTimeoutMinutes,
            defaultUserRole,
            allowAccountCreation,
        });

        res.json({ message: "Setări salvate" });
    } catch (err) {
        console.error("Error updating settings:", err);
        res.status(500).json({ error: "Eroare internă de server" });
    }
});

router.post("/change-password", requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
    };

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Parola curentă și noua parolă sunt obligatorii." });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: "Parola nouă trebuie să aibă cel puțin 8 caractere." });
    }

    try {
        const sessionUser = (req.session as any).user;

        const result = await pool.query(
            "SELECT id, password_hash FROM app_user WHERE id = $1",
            [sessionUser.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilizatorul nu a fost găsit." });
        }

        const user = result.rows[0];

        const ok = await bcrypt.compare(currentPassword, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: "Parola curentă este incorectă." });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE app_user SET password_hash = $1 WHERE id = $2",
            [newHash, user.id]
        );

        res.json({ message: "Parola a fost actualizată cu succes." });
    } catch (err) {
        console.error("Error changing password:", err);
        res.status(500).json({ error: "Eroare internă de server" });
    }
});

export default router