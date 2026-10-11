// APIキー不要の動作確認用プロバイダ。入力をそのまま少しずつ返す。
export function createMockProvider() {
  return {
    name: "mock",
    model: "mock",

    async *streamChat({ messages, signal }) {
      const last = messages.at(-1)?.content ?? "";
      const reply = `(mock) あなたは「${last}」と言いました。これはAPIを使わないダミー応答です。`;
      for (const ch of reply) {
        if (signal?.aborted) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield ch;
      }
    },
  };
}
