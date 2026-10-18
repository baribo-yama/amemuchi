
export class ValidationError extends Error {}

const ROLES = new Set(["user", "assistant"]);

// チャットのビジネスロジック層
export function createChatService({ provider, logger, config }) {
  // リクエストの検証と履歴の整形
  function parseRequest(body) {
    const { sessionId, messages } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError("messages は1件以上の配列で指定してください");
    }

    for (const m of messages) {
      if (
        !m ||
        !ROLES.has(m.role) ||
        typeof m.content !== "string" ||
        m.content.trim() === ""
      ) {
        throw new ValidationError(
          "messages の各要素は { role: 'user'|'assistant', content: string } にしてください"
        );
      }

      if (m.content.length > config.chat.maxMessageChars) {
        throw new ValidationError(
          `1メッセージは${config.chat.maxMessageChars}文字までです`
        );
      }
    }

    if (messages.at(-1).role !== "user") {
      throw new ValidationError("最後のメッセージは user にしてください");
    }

    // assistantの発言数からキャラクターを選ぶ
    const assistantCount = messages.filter(
      (m) => m.role === "assistant"
    ).length;

    const mode = assistantCount % 2 === 0 ? "ame" : "muchi";

    return {
      sessionId:
        typeof sessionId === "string" && sessionId
          ? sessionId.slice(0, 64)
          : "anonymous",
      mode,
      messages: messages.slice(-config.chat.maxHistoryMessages),
    };
  }

  // 返答をチャンクごとに yield する
  async function* streamReply({ sessionId, messages, mode, signal }) {
    const startedAt = Date.now();
    const base = {
      sessionId,
      provider: provider.name,
      model: provider.model,
    };

    logger.log("request", {
      ...base,
      mode,
      historyLength: messages.length,
      userMessage: messages.at(-1).content,
    });

    let reply = "";

    try {
      for await (const text of provider.streamChat({
        messages,
        systemInstruction:
          config.systemPrompts?.[mode] || config.systemPrompts?.ame || config.systemPrompt,
        signal,
      })) {
        reply += text;
        yield text;
      }

      if (signal?.aborted) {
        logger.log("aborted", {
          ...base,
          latencyMs: Date.now() - startedAt,
          partialReply: reply,
        });
        return;
      }

      logger.log("response", {
        ...base,
        latencyMs: Date.now() - startedAt,
        reply,
      });
    } catch (err) {
      if (signal?.aborted) {
        logger.log("aborted", {
          ...base,
          latencyMs: Date.now() - startedAt,
          partialReply: reply,
        });
        return;
      }

      logger.log("error", {
        ...base,
        latencyMs: Date.now() - startedAt,
        message: err.message,
        partialReply: reply,
      });

      throw err;
    }
  }

  return { parseRequest, streamReply };
}
