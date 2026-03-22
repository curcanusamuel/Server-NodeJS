import { Router } from "express";
import { db as pool } from "../../db/pool";
import bcrypt from "bcrypt";

const router = Router();

//get count of accounts
router.get("/count", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const result = await pool.query("SELECT COUNT(*) AS count FROM app_user");

        const count = Number(result.rows[0].count);

        return res.json({ count });

    } catch (err) {
        console.error("Error getting account count:", err);
        return res.status(500).json({ error: "Erorare interna de server" })
    }
});

//get all accounts
router.get("/users/getAccounts", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const result = await pool.query("SELECT * FROM app_user");

        return res.json({ result })

    } catch (err) {
        console.error("Error getting accounts", err);
        return res.status(500).json({ error: "Erorare interna de server" })
    }
});

//get id by name
router.get("/users/getIDbyName", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const { username } = req.query;  // ?username=...

        if (!username) {
            return res.status(400).json({ error: "Missing username parameter" });
        }

        const result = await pool.query(
            "SELECT id FROM app_user WHERE username = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ id: result.rows[0].id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


//insert user endpoint
router.post("/users", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ error: "Lipsesc câmpuri obligatorii" });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO app_user (username, password_hash, role, is_active)
             VALUES ($1, $2, $3, true)
             RETURNING id, username, role, is_active`,
            [username, password_hash, role]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("POST /users error:", err);
        res.status(500).json({ error: "Eroare server" });
    }
});

//update user endpoint
router.put("/users/:id", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const { id } = req.params;
        const { username, role, is_active } = req.body;

        if (!username || !role || is_active === undefined) {
            return res.status(400).json({ error: "Lipsesc câmpuri obligatorii" });
        }

        const result = await pool.query(
            `UPDATE app_user
             SET username = $1,
                 role = $2,
                 is_active = $3
             WHERE id = $4
             RETURNING id, username, role, is_active`,
            [username, role, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("PUT /users/:id error:", err);
        res.status(500).json({ error: "Eroare server" });
    }
});


//update password endpoint
router.put("/users/:id/password", async (req, res) => {
    const { password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE app_user SET password_hash=$1 WHERE id=$2", [hash, req.params.id]);
    res.json({ success: true });
});


//delete user endpoint
router.delete("/users/:id", async (req, res) => {
    try {
        const sessionUser = (req.session as any).user;

        if (!sessionUser || sessionUser.role !== "ADMIN") {
            return res.status(403).json({ error: "Acces interzis" });
        }

        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM app_user WHERE id = $1",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
        }

        res.status(204).send();
    } catch (err) {
        console.error("DELETE /users/:id error:", err);
        res.status(500).json({ error: "Eroare server" });
    }
});

export default router