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
  // 最初の delta が届くまで「。」を 1〜3 個で循環表示
  let dots = 0;
  const tick = () => (output.textContent = "回答を生成中" + "。".repeat((dots++ % 3) + 1));
  tick();
  const timer = setInterval(tick, 500);
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
        clearInterval(timer);
        reply += event.text;
        output.textContent = reply;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (err) {
    output.textContent = err.message;
  } finally {
    clearInterval(timer);
  }
  if (reply) {
    state.messages.push({ role: "assistant", content: reply });
    save(state);
  }
}




const characterImage = document.getElementById("characterImage");

// サーバーから回答モードを受け取って画像を切り替える
const mode = state?.mode ?? "ame";

if (characterImage) {
  characterImage.src =
    mode === "muchi"
      ? "./あめむち2.png"
      : "./あめむち.png";
}