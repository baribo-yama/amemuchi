// 入力ページ(index.html)と出力ページ(1.html)の共通部分。
// 2ページ間の受け渡しは localStorage 経由。

const STORAGE_KEY = "gemini-chat:v1";

export function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 保存できなくても動作には影響しない */
  }
}

export function newState() {
  return { sessionId: crypto.randomUUID(), messages: [] };
}

// SSE の読み取り(fetch の ReadableStream を1イベントずつ取り出す)
export async function* readEvents(body) {
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
