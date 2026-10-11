// ブラウザ側は「表示」と「サーバー(/api/chat)への送信」だけを担当する。
// Gemini のことは一切知らない(APIキーもサーバーにしかない)。

const STORAGE_KEY = "gemini-chat:v1";

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("form"),
  input: document.getElementById("input"),
  send: document.getElementById("send"),
  stop: document.getElementById("stop"),
  newChat: document.getElementById("new-chat"),
};

// ---- 状態(リロードしても会話が残るよう localStorage に保存) ----
const state = load() ?? { sessionId: crypto.randomUUID(), messages: [] };
let controller = null;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 保存できなくても動作には影響しない */
  }
}

// ---- 描画 ----
function addBubble(role, text = "") {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  els.messages.append(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderAll() {
  els.messages.replaceChildren();
  if (state.messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "メッセージを送って会話を始めましょう";
    els.messages.append(empty);
    return;
  }
  for (const m of state.messages) addBubble(m.role, m.content);
}

function setBusy(busy) {
  els.send.hidden = busy;
  els.stop.hidden = !busy;
  els.input.disabled = busy;
  if (!busy) els.input.focus();
}

function autoResize() {
  els.input.style.height = "auto";
  els.input.style.height = `${els.input.scrollHeight}px`;
}

// ---- SSE の読み取り(fetch の ReadableStream を1イベントずつ取り出す) ----
async function* readEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data);
    }
  }
}

// ---- 送信 ----
async function sendMessage(text) {
  document.querySelector(".empty")?.remove();
  document.querySelectorAll(".msg.error").forEach((el) => el.remove());

  state.messages.push({ role: "user", content: text });
  const userBubble = addBubble("user", text);

  const bubble = addBubble("assistant");
  bubble.classList.add("pending");
  let reply = "";
  let failed = false;

  controller = new AbortController();
  setBusy(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, messages: state.messages }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `サーバーエラー (HTTP ${res.status})`);
    }

    for await (const event of readEvents(res.body)) {
      if (event.type === "delta") {
        reply += event.text;
        bubble.textContent = reply;
        scrollToBottom();
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      failed = true;
      addBubble("error", err.message);
    }
  } finally {
    bubble.classList.remove("pending");
    controller = null;

    if (reply) {
      // 停止した場合も、そこまでの返答は会話に残す
      state.messages.push({ role: "assistant", content: reply });
    } else {
      // 返答が空なら送信自体をなかったことにして、入力欄に戻す
      bubble.remove();
      userBubble.remove();
      state.messages.pop();
      els.input.value = text;
      autoResize();
    }
    save();
    setBusy(false);
    if (failed) scrollToBottom();
  }
}

// ---- イベント ----
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text || controller) return;
  els.input.value = "";
  autoResize();
  sendMessage(text);
});

els.input.addEventListener("keydown", (e) => {
  // 日本語入力の変換確定のEnterでは送信しない
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

els.input.addEventListener("input", autoResize);
els.stop.addEventListener("click", () => controller?.abort());

els.newChat.addEventListener("click", () => {
  controller?.abort();
  state.sessionId = crypto.randomUUID();
  state.messages = [];
  save();
  renderAll();
  els.input.focus();
});

renderAll();
