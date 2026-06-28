import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      avatar: string;
    };
  }
}

/** Check user is logged in via Discord OAuth. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    return next();
  }
  res.status(401).json({ error: "未登录。请先通过 Discord 登录。" });
}
