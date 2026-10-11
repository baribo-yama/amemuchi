import fs from "node:fs";
import path from "node:path";

// 日付(ローカル時間)ごとの JSONL ファイルに1イベント1行で追記する。
//   logs/chat-2026-10-11.jsonl
// ログの書き込みに失敗してもチャット本体は止めない。
export function createLogger({ dir }) {
  fs.mkdirSync(dir, { recursive: true });

  const localDate = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD

  function log(event, data = {}) {
    const now = new Date();
    const record = { ts: now.toISOString(), event, ...data };
    const file = path.join(dir, `chat-${localDate(now)}.jsonl`);
    fs.appendFile(file, JSON.stringify(record) + "\n", (err) => {
      if (err) console.error("[logger] ログの書き込みに失敗:", err.message);
    });
  }

  return { log, dir };
}
