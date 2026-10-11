import express from "express";
import path from "node:path";
import { createChatRouter } from "./routes/chat.js";

// Express アプリの組み立て。ルートやミドルウェアを増やすときはここに足す。
//   例: app.use("/api", rateLimit(...)) や app.use("/api", createHistoryRouter(...))
export function createApp({ chatService, rootDir }) {
  const app = express();

  app.use(express.json({ limit: "200kb" }));
  app.use(express.static(path.join(rootDir, "public")));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", createChatRouter({ chatService }));

  return app;
}
