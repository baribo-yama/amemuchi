import { GoogleGenAI } from "@google/genai";

// LLMプロバイダの共通インターフェース:
//   { name, model, streamChat({ messages, systemInstruction, signal }) -> AsyncGenerator<string> }
//   messages は { role: "user" | "assistant", content: string } の配列
// 別のLLMに差し替えたいときは、同じ形のファイルを providers/ に足して index.js に登録する。
export function createGeminiProvider({ apiKey, model }) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が未設定です。.env に設定してください(動作確認だけなら LLM_PROVIDER=mock)");
  }
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    model,

    async *streamChat({ messages, systemInstruction, signal }) {
      const stream = await ai.models.generateContentStream({
        model,
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: systemInstruction || undefined,
          abortSignal: signal,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) yield chunk.text;
      }
    },
  };
}
