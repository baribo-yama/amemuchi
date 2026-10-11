import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// システムプロンプトは prompts/system.txt を編集するだけで変えられる
const systemPromptPath = path.join(rootDir, "prompts", "system.txt");
const systemPrompt = fs.existsSync(systemPromptPath)
  ? fs.readFileSync(systemPromptPath, "utf8").trim()
  : "";

export const config = {
  rootDir,
  port: int(process.env.PORT, 3000),
  provider: process.env.LLM_PROVIDER ?? "gemini",
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  },
  systemPrompt,
  chat: {
    maxHistoryMessages: int(process.env.MAX_HISTORY_MESSAGES, 20),
    maxMessageChars: int(process.env.MAX_MESSAGE_CHARS, 4000),
  },
  logDir: path.resolve(rootDir, process.env.LOG_DIR ?? "logs"),
};
