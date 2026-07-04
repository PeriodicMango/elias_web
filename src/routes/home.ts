import { Router } from "express";
import { createLoader } from "../lazyLoad.js";

const router = Router();

// Cached greetings per persona (regenerate on restart)
const greetingCache = new Map<string, string>();

const promptLoader = createLoader(() => import("../../../../eliasCore/src/prompt.js"));
const llmLoader = createLoader(() => import("../../../../eliasCore/src/llm.js"));
const personasLoader = createLoader(() => import("../../../../eliasCore/src/helpers/personas.js"));

// GET /api/home/greeting?persona=wanshi
router.get("/greeting", async (req, res) => {
  try {
    const persona = (req.query.persona as string) || "elias";

    // Return cached greeting if available
    const cached = greetingCache.get(persona);
    if (cached) {
      return res.json({ greeting: cached });
    }

    const [prompt, llm, personas] = await Promise.all([
      promptLoader(), llmLoader(), personasLoader(),
    ]);

    // Assemble greeting prompt: persona soul + auth-level fragment only.
    // Uses mode "greeting" which includes auth fragments but skips the
    // full chat formatting rules, tools, and Phase 1/2 reasoning.
    const title = await personas.getMasterTitle(persona);
    const greetingSystem = await prompt.assemblePrompt({
      persona,
      senderLevel: "master",
      mode: "greeting",
      variables: { PERSONA_TITLE: title, MASTER_NAME: "漓琊" },
    });

    // Generate a short greeting in the persona's voice
    const result = await llm.chat(
      [
        { role: "system", content: greetingSystem },
        {
          role: "user",
          content:
            "现在是用户打开控制台看到的首页。请用你的语气说一句简短的问候语（一句话，不超过30个字）。不要问句，不要说'需要帮忙吗'之类的话——只是打个招呼。不要用emoji。像刚注意到用户来了，随口说的一句话。中文。",
        },
      ],
      {},
    );

    const greeting = result.text.trim() || "嗯，来了。";
    greetingCache.set(persona, greeting);

    res.json({ greeting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as homeRouter };
