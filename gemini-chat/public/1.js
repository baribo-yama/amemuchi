// 出力ページ: 最後のユーザー発言をサーバー(/api/chat)へ送り、返答を #output に表示する。
// 見た目は後から差し替え可。必要なのは #output への書き込みだけ。

import { load, save, readEvents } from "./shared.js";

const output = document.getElementById("output");
const state = load();
const last = state?.messages.at(-1);

// 未送信のユーザー発言があるときだけ送る(リロードでの二重送信防止)
if (last?.role === "user") {
  run();
} else if (last?.role === "assistant") {
  output.textContent = last.content;
}

async function run() {
  let reply = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, messages: state.messages }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `サーバーエラー (HTTP ${res.status})`);
    }
    for await (const event of readEvents(res.body)) {
      if (event.type === "delta") {
        reply += event.text;
        output.textContent = reply;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (err) {
    output.textContent = err.message;
  }
  if (reply) {
    state.messages.push({ role: "assistant", content: reply });
    save(state);
  }
}
