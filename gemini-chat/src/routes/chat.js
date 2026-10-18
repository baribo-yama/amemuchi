import { Router } from "express";
import { ValidationError } from "../services/chatService.js";

// POST /api/chat
//   body: { sessionId, messages: [{ role, content }, ...] }
//   応答: Server-Sent Events。各イベントは JSON:
//     { type: "delta", text }   … 返答の続き
//     { type: "done" }          … 完了
//     { type: "error", message } … 失敗
export function createChatRouter({ chatService }) {
  const router = Router();

  router.post("/chat", async (req, res) => {
    let input;
    try {
      input = chatService.parseRequest(req.body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // クライアントが切断(停止ボタン・タブを閉じる)したらLLMの呼び出しも止める
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    // AIのストリーミングレスポンス（文字が少しずつ出る表現
    // レスポンス文章が全て完成してから返す、のではなく確定している単語から返すようにしている
    // キャッシュとバッファリングを貯めると返答が送れるのでオフにする
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      for await (const text of chatService.streamReply({ ...input, signal: controller.signal })) {
        send({ type: "delta", text });
      }
      if (!controller.signal.aborted) send({ type: "done" });
    } catch (err) {
      // 詳細はログに残してあるので、画面には汎用メッセージだけ返す
      console.error("[chat] error:", err.message);
      send({ type: "error", message: "AIの応答中にエラーが発生しました。しばらくしてからもう一度お試しください。" });
    } finally {
      res.end();
    }
  });

  return router;
}
