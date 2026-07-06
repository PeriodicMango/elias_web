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

/** Check user is logged in via Discord OAuth session or API token. */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1. Session cookie (same-origin web console)
  if (req.session?.user) {
    return next();
  }

  // 2. Bearer token (cross-origin Capacitor / PWA)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // Lazy import to avoid circular dependency
      const { verifyApiToken } = await import("../routes/auth.js");
      const user = verifyApiToken(token);
      if (user) {
        // Attach user to request so downstream handlers can access it
        (req as Request & { apiUser?: typeof user }).apiUser = user;
        return next();
      }
    } catch {
      // fall through to 401
    }
  }

  res.status(401).json({ error: "未登录。请先通过 Discord 登录。" });
}
