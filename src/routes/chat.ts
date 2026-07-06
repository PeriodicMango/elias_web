import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { parseMoodTag } from "../../../../eliasCore/src/helpers/moodParser.js";
import { createLoader } from "../lazyLoad.js";
import type { ChatMessage } from "../../../../eliasCore/src/llm.js";

const router = Router();

const chatSchema = z.object({
  persona: z.string().optional(),
  message: z.string().min(1, "消息不能为空"),
  fastMode: z.boolean().optional(),
});

// Module loaders — each module is lazy-loaded once, cached thereafter
const llmLoader = createLoader(() => import("../../../../eliasCore/src/llm.js"));
const promptLoader = createLoader(() => import("../../../../eliasCore/src/prompt.js"));
const memoryLoader = createLoader(() => import("../../../../eliasCore/src/memory.js"));
const historyLoader = createLoader(() => import("../../../../eliasCore/src/helpers/history.js"));
const configLoader = createLoader(() => import("../../../../eliasCore/src/config.js"));
const statusLoader = createLoader(() => import("../../../../eliasCore/src/helpers/status.js"));
const toolsLoader = createLoader(() => import("../../../../eliasCore/src/helpers/tools/index.js"));

// POST /api/chat
router.post("/", validate(chatSchema), async (req, res) => {
  try {
    const { persona, message, fastMode } = req.body as z.infer<typeof chatSchema>;

    const p = persona?.trim() || "elias";

    // Load all modules in parallel (cached after first call)
    const [llm, prompt, memory, historyMod, config, statusMod, tools] =
      await Promise.all([
        llmLoader(),
        promptLoader(),
        memoryLoader(),
        historyLoader(),
        configLoader(),
        statusLoader(),
        toolsLoader(),
      ]);

    // 1. Load persona identity
    const [soul, title] = await Promise.all([
      prompt.loadSoul(p),
      import("../../../../eliasCore/src/helpers/personas.js").then((m) =>
        m.getPersonaTitle(p),
      ),
    ]);

    // 2. Assemble system prompts
    const ctxBase = {
      persona: p,
      senderLevel: "master" as const,
      variables: { PERSONA_TITLE: title, MASTER_NAME: "漓琊" },
    };

    const [thinkingPrompt, replyPrompt, userProfile, dynamicRules, notebook] =
      await Promise.all([
        prompt.assemblePrompt({ ...ctxBase, mode: "chat-thinking" }),
        prompt.assemblePrompt({ ...ctxBase, mode: "chat-reply" }),
        prompt.loadUserProfile(),
        prompt.loadDynamicRules(),
        prompt.loadPersonaNotebook(p),
      ]);

    // 3. Load context
    const [recentMem, semKb, userCtx, statusPrompt, wakeUp] = await Promise.all([
      memory.getRecentMemory(p),
      memory.getSemanticKnowledge(message),
      memory.getUserContext(message),
      statusMod.getStatusPrompt(p),
      statusMod.onUserMessage("master", p),
    ]);

    const now = new Date();
    const contextSuffix = [
      `当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Australia/Sydney" })}`,
      statusPrompt || "",
      wakeUp || "",
      recentMem || "",
      semKb || "",
      userCtx || "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // 4. Build system prompts
    const thinkingSystem = [
      soul,
      thinkingPrompt,
      userProfile || "",
      dynamicRules || "",
      notebook || "",
      contextSuffix,
    ]
      .filter(Boolean)
      .join("\n\n");

    const replySystem = [
      soul,
      replyPrompt,
      userProfile || "",
      dynamicRules || "",
      notebook || "",
      contextSuffix,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 5. History
    const historyPath = config.personaPath(p, "history", "web-dm.md");
    const history = await historyMod.getHistory(historyPath);
    history.push({ role: "user", content: message } as ChatMessage);


    // 7. LLM call
    const toolDefs = tools.getAllToolDefinitions();
    const result = fastMode
      ? await llm.chat(
          [
            { role: "system", content: replySystem },
            ...history,
          ],
          { tools: toolDefs, senderLevel: "master" },
        )
      : await llm.chatDualPipeline(history, thinkingSystem, replySystem, {
          tools: toolDefs,
          senderLevel: "master",
        });

    // 8. Post-process
    const { mood, text: reply } = parseMoodTag(result.text || "");
    const thinking = result.thinking || "";
    const toolsUsed = result.toolsUsed || [];

    // Sanitize
    const sanitized = reply
      .replace(/\[\/system\]/gi, "")
      .replace(new RegExp(`^${p}\\s*[:：]?\\s*`, "i"), "")
      .trim();

    // 9. Persist
    const ts = now.toLocaleString("zh-CN", { timeZone: "Australia/Sydney" });
    const date = memory.todayString();
    historyMod.pushHistoryMessage(historyPath, { role: "assistant", content: sanitized });
    historyMod.appendHistory(historyPath, `[${ts}] Web User: ${message}`);
    historyMod.appendHistory(historyPath, `[${ts}] ${title}: ${sanitized}`);
    memory.appendDailyLogRaw(
      `[${memory.timeString()}] Web User: ${message}\n[${memory.timeString()}] ${title}: ${sanitized}\n`,
      p,
    );

    // 10. Return
    res.json({
      reply: sanitized || "（……）",
      thinking,
      toolsUsed,
      mood,
    });
  } catch (err: unknown) {
    console.error("[CHAT] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "对话出错。", detail: message });
  }
});

// POST /api/chat/clear
router.post("/clear", async (_req, res) => {
  try {
    const config = await configLoader();
    const hist = await historyLoader();
    const persona = "elias";
    const historyPath = config.personaPath(persona, "history", "web-dm.md");
    await hist.clearHistory(historyPath);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export { router as chatRouter };
