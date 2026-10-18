// 入力ページ: メッセージを保存して出力ページ(1.html)へ移動するだけ。
// 送信(/api/chat)と表示は 1.js が担当。

import { load, save, newState } from "./shared.js";

const els = {
  form: document.getElementById("form"),
  input: document.getElementById("input"),
  newChat: document.getElementById("new-chat"),
  logbox: document.getElementById("log-box"),
  logbutton: document.getElementById("log-button"),
};

const state = load() ?? newState();

function autoResize() {
  els.input.style.height = "auto";
  els.input.style.height = `${els.input.scrollHeight}px`;
}

els.logbutton.addEventListener("click", (e) => {
  els.logbox.hidden = !els.logbox.hidden;
  console.log(state.messages);
})

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  state.messages.push({ role: "user", content: text });
  save(state);
  location.href = "1.html";
});

els.input.addEventListener("keydown", (e) => {
  // 日本語入力の変換確定のEnterでは送信しない
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

els.input.addEventListener("input", autoResize);

els.newChat.addEventListener("click", () => {
  Object.assign(state, newState());
  save(state);
  els.input.focus();
});

state.messages.forEach((m) => {
  const item =document.createElement("div");
  item.textContent = m.content;
  item.style.top = Math.random() * 100 + "%";
  item.style.left = Math.random() * 100 + "%";
  item.style.animationDelay = - Math.random() * 4 + "s";
  item.style.setProperty("--dx", (Math.random() - 0.5) * 65 + "px")
  item.style.setProperty("--dy", (Math.random() - 0.5) * 65 + "px")
  els.logbox.appendChild(item);
});