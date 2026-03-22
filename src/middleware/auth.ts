// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any).user;
  if (!user) {
    return res.status(401).json({ error: "Neautorizat" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any).user;
  if (!user || user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acces interzis" });
  }
  next();
}