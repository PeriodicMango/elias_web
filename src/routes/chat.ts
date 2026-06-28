import { Router } from "express";

const router = Router();

// Lazy-loaded elias imports
let chatDualPipeline: Function;
let chat: Function;
let loadSoul: Function;
let assemblePrompt: Function;
let loadUserProfile: Function;
let loadDynamicRules: Function;
let loadPersonaNotebook: Function;
let getRecentMemory: Function;
let getSemanticKnowledge: Function;
let getUserContext: Function;
let appendDailyLogRaw: Function;
let getHistory: Function;
let pushHistoryMessage: Function;
let appendHistory: Function;
let personaPath: Function;
let getCurrentStatus: Function;
let getStatusPrompt: Function;
let onUserMessage: Function;
let getAllToolDefinitions: Function;
let timeString: Function;
let todayString: Function;

async function loadModules() {
  const llm = await import("../../elias/src/llm.js");
  chatDualPipeline = llm.chatDualPipeline;
  chat = llm.chat;

  const prompt = await import("../../elias/src/prompt.js");
  loadSoul = prompt.loadSoul;
  assemblePrompt = prompt.assemblePrompt;
  loadUserProfile = prompt.loadUserProfile;
  loadDynamicRules = prompt.loadDynamicRules;
  loadPersonaNotebook = prompt.loadPersonaNotebook;

  const memory = await import("../../elias/src/memory.js");
  getRecentMemory = memory.getRecentMemory;
  getSemanticKnowledge = memory.getSemanticKnowledge;
  getUserContext = memory.getUserContext;
  appendDailyLogRaw = memory.appendDailyLogRaw;
  timeString = memory.timeString;
  todayString = memory.todayString;

  const historyMod = await import("../../elias/src/helpers/history.js");
  getHistory = historyMod.getHistory;
  pushHistoryMessage = historyMod.pushHistoryMessage;
  appendHistory = historyMod.appendHistory;

  const config = await import("../../elias/src/config.js");
  personaPath = config.personaPath;

  const statusMod = await import("../../elias/src/helpers/status.js");
  getCurrentStatus = statusMod.getCurrentStatus;
  getStatusPrompt = statusMod.getStatusPrompt;
  onUserMessage = statusMod.onUserMessage;

  const tools = await import("../../elias/src/helpers/tools/index.js");
  getAllToolDefinitions = tools.getAllToolDefinitions;
}

// Parse [mood: xxx] tag from response text
function parseMoodTag(text: string): { mood: string; text: string } {
  const match = text.match(/\[心情[:：]\s*([^\]]+)\]/);
  if (!match) return { mood: "平静", text };
  return { mood: match[1]!, text: text.replace(match[0]!, "").trim() };
}

// POST /api/chat
router.post("/", async (req, res) => {
  try {
    const { persona, message, fastMode } = req.body as {
      persona?: string;
      message?: string;
      fastMode?: boolean;
    };

    if (!message?.trim()) {
      return res.status(400).json({ error: "消息不能为空。" });
    }

    const p = persona?.trim() || "elias";
    if (!chatDualPipeline) await loadModules();

    // 1. Load persona identity
    const [soul, title] = await Promise.all([
      loadSoul(p),
      import("../../elias/src/helpers/personas.js").then((m) =>
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
        assemblePrompt({ ...ctxBase, mode: "chat-thinking" }),
        assemblePrompt({ ...ctxBase, mode: "chat-reply" }),
        loadUserProfile(),
        loadDynamicRules(),
        loadPersonaNotebook(p),
      ]);

    // 3. Load context
    const [recentMem, semKb, userCtx, statusPrompt] = await Promise.all([
      getRecentMemory(p),
      getSemanticKnowledge(message),
      getUserContext(message),
      getStatusPrompt(p),
    ]);

    const now = new Date();
    const contextSuffix = [
      `当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Australia/Sydney" })}`,
      statusPrompt || "",
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
    const historyPath = personaPath(p, "history", "web-dm.md");
    const history = await getHistory(historyPath);
    history.push({ role: "user", content: message });

    // 6. Status wake-up
    const wakeUp = await onUserMessage("master", p);

    // 7. LLM call
    const tools = getAllToolDefinitions();
    const result: any = fastMode
      ? await chat(
          [
            { role: "system", content: replySystem },
            ...history,
          ],
          { tools, senderLevel: "master" },
        )
      : await chatDualPipeline(history, thinkingSystem, replySystem, {
          tools,
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
    const date = todayString();
    pushHistoryMessage(historyPath, { role: "assistant", content: sanitized });
    appendHistory(historyPath, `[${ts}] Web User: ${message}`);
    appendHistory(historyPath, `[${ts}] ${title}: ${sanitized}`);
    appendDailyLogRaw(
      `[${timeString()}] Web User: ${message}\n[${timeString()}] ${title}: ${sanitized}\n`,
      p,
    );

    // 10. Return
    res.json({
      reply: sanitized || "（……）",
      thinking,
      toolsUsed,
      mood,
    });
  } catch (err: any) {
    console.error("[CHAT] Error:", err);
    res.status(500).json({
      error: "对话出错。",
      detail: err.message,
    });
  }
});

// POST /api/chat/clear
router.post("/clear", async (_req, res) => {
  try {
    if (!personaPath) await loadModules();
    // We need to import clearHistory
    const { clearHistory } = await import(
      "../../elias/src/helpers/history.js"
    );
    // Get current persona from request or default
    const persona = "elias"; // Default — web only has one user context
    const historyPath = personaPath(persona, "history", "web-dm.md");
    await clearHistory(historyPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as chatRouter };
