import { Router } from "express";

const router = Router();

let manageGoals: Function;

async function load() {
  const g = await import("../../../elias/src/helpers/tools/executors/goals.js");
  manageGoals = g.manageGoals;
}

router.get("/", async (_req, res) => {
  try {
    if (!manageGoals) await load();
    const result = await manageGoals({ action: "list" });
    // For the web UI, return parsed data
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!manageGoals) await load();
    const { action, description, due } = req.body as {
      action?: string;
      description?: string;
      due?: string;
    };
    if (action === "add") {
      if (!description) return res.status(400).json({ error: "description 是必填项。" });
      const result = await manageGoals({ action: "add", description, due: due || "" });
      return res.json({ ok: true, message: result.content });
    }
    res.status(400).json({ error: "未知操作。" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!manageGoals) await load();
    const { id } = req.params;
    const { action } = req.body as { action?: string };
    if (action === "done") {
      const result = await manageGoals({ action: "done", id });
      return res.json({ ok: true, message: result.content });
    }
    res.status(400).json({ error: "未知操作。" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as goalsRouter };
