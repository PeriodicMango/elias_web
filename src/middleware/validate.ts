// ---------------------------------------------------------------------------
// Zod validation middleware
// ---------------------------------------------------------------------------
// Usage: router.post("/path", validate(MySchema), handler)
// Returns 400 with Zod error details on validation failure.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure, returns 400 with human-readable error messages.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map(
          (e) => `${e.path.map(String).join(".") || "body"}: ${e.message}`
        );
        res.status(400).json({ error: messages.join("; ") });
        return;
      }
      next(err);
    }
  };
}
