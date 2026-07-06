import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createLoader } from "../lazyLoad.js";

const router = Router();

const goalsAddSchema = z.object({
  action: z.literal("add"),
  description: z.string().min(1, "description 是必填项"),
  due: z.string().optional(),
});

const goalsDoneSchema = z.object({
  action: z.literal("done"),
});

const goalsLoader = createLoader(() =>
  import("../../../../eliasCore/src/helpers/tools/executors/goals.js"),
);

router.get("/", async (_req, res) => {
  try {
    const g = await goalsLoader();
    const { manageGoals } = g;
    const result = await manageGoals({ action: "list" });
    const content = result.content as string;
    const lines = content.split("\n").filter((l: string) => l.trim() && !l.startsWith("###"));
    const goals = lines.map((l: string) => {
      const cleaned = l.replace(/^-\s*/, "");
      const idMatch = cleaned.match(/\[(goal-\S+)\]/);
      return {
        id: idMatch?.[1] ?? "",
        text: cleaned,
        raw: l,
      };
    });
    res.json({ goals, raw: content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/", validate(goalsAddSchema), async (req, res) => {
  try {
    const g = await goalsLoader();
    const { action, description, due } = req.body as z.infer<typeof goalsAddSchema>;
    if (action === "add") {
      if (!description) return res.status(400).json({ error: "description 是必填项。" });
      const result = await g.manageGoals({ action: "add", description, due: due || "" });
      return res.json({ ok: true, message: result.content });
    }
    res.status(400).json({ error: "未知操作。" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put("/:id", validate(goalsDoneSchema), async (req, res) => {
  try {
    const g = await goalsLoader();
    const { id } = req.params;
    const { action } = req.body as z.infer<typeof goalsDoneSchema>;
    if (action === "done") {
      const result = await g.manageGoals({ action: "done", id });
      return res.json({ ok: true, message: result.content });
    }
    res.status(400).json({ error: "未知操作。" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as goalsRouter };
