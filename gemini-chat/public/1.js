import { load, save, readEvents } from "./shared.js";

const output = document.getElementById("output");
const characterImage = document.getElementById("characterImage");
const state = load();
const last = state?.messages?.at(-1);

// サーバー側と同じルールで回答モードを決める
function getMode(messages) {
  const assistantCount = messages.filter(
    (message) => message.role === "assistant"
  ).length;

  return assistantCount % 2 === 0 ? "ame" : "muchi";
}

// 回答モードに合わせて画像・名前・デザインを切り替える
function showCharacter(mode) {
  if (!characterImage) return;

  const isMuchi = mode === "muchi";

  // CSSの配色切り替えに使う
  document.body.dataset.character = mode;

  // 画像を切り替える
  characterImage.src = isMuchi
    ? "./image/むちさん.png"
    : "./image/あめさん.png";

  // 名前を切り替える
  const characterName = document.getElementById("characterName");

  if (characterName) {
    characterName.textContent = isMuchi ? "むち" : "あめ";
  }
}

// ページを開いたときの処理
if (!state || !Array.isArray(state.messages)) {
  output.textContent =
    "会話データが見つかりません。最初の画面からやり直してください。";
} else if (last?.role === "user") {
  // 今から生成する回答のモードで画像・デザインを表示
  showCharacter(getMode(state.messages));
  run();
} else if (last?.role === "assistant") {
  // 保存済みの最後の回答に対応する画像・デザインを表示
  const assistantCount = state.messages.filter(
    (message) => message.role === "assistant"
  ).length;

  showCharacter((assistantCount - 1) % 2 === 0 ? "ame" : "muchi");
  output.textContent = last.content;
}

async function run() {
  let reply = "";
  let dots = 0;

  const tick = () => {
    output.textContent =
      "回答を生成中" + "。".repeat((dots++ % 3) + 1);
  };

  tick();
  const timer = setInterval(tick, 500);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        messages: state.messages,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error ?? `サーバーエラー (HTTP ${response.status})`
      );
    }

    for await (const event of readEvents(response.body)) {
      if (event.type === "delta") {
        clearInterval(timer);
        reply += event.text;
        output.textContent = reply;
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    if (reply) {
      state.messages.push({
        role: "assistant",
        content: reply,
      });

      save(state);
    }
  } catch (error) {
    output.textContent =
      error.message || "エラーが発生しました。";
  } finally {
    clearInterval(timer);
  }
}