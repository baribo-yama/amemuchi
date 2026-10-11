# Gemini Chat

Gemini API を使ったシンプルなチャットアプリです。
フロントは HTML / CSS / JS、サーバーは Node.js (Express) で、**APIキーはサーバーにだけ置きます**。
会話のログはローカルの `logs/` に JSONL で保存されます。

## セットアップ

```bash
npm install
cp .env.example .env     # .env を開いて GEMINI_API_KEY を設定
npm start                # → http://localhost:3000
```

- APIキーは [Google AI Studio](https://aistudio.google.com/apikey) で発行します
- キーなしで画面だけ試すなら、`.env` を `LLM_PROVIDER=mock` にするとダミー応答が返ります
- モデル名は `.env` の `GEMINI_MODEL` で変更できます(最新は [公式](https://ai.google.dev/gemini-api/docs/models) を確認)
- 開発中は `npm run dev` でファイル変更時に自動再起動します
- Node.js 20 以上が必要です

## 構成

```
[Browser]  public/index.html, style.css, app.js
   │  POST /api/chat  { sessionId, messages }   ← SSEで返答を逐次受信
   ▼
[routes/chat.js]        HTTP/SSEの入出力だけ。切断されたらLLM呼び出しも中止
   ▼
[services/chatService]  検証・履歴の切り詰め・ログ記録(機能追加の中心)
   ├─ [lib/logger]            logs/chat-YYYY-MM-DD.jsonl に追記
   ▼
[providers/*]           LLMごとの差異を吸収(gemini / mock)
   ▼
[Gemini API]
```

```
server.js            依存の組み立てだけを行うエントリポイント
src/config.js        環境変数・設定の読み込み
src/app.js           Express アプリの組み立て(ルート・ミドルウェアの登録)
src/routes/          HTTPの入口
src/services/        ビジネスロジック
src/providers/       LLMの接続(共通インターフェース: streamChat)
src/lib/logger.js    ローカルログ
prompts/system.txt   システムプロンプト(ここを書き換えるだけでAIの役割が変わる)
public/              フロント(ビルド不要)
```

## 機能を足すとき

| やりたいこと | 触る場所 |
|---|---|
| AIの役割・口調を変える | `prompts/system.txt` |
| 別のLLM(Claude など)に対応 | `src/providers/` に `streamChat` を持つファイルを足し、`providers/index.js` に1行登録 |
| レート制限・認証 | `src/app.js` でミドルウェアを `/api` の前に追加 |
| 履歴の要約・トークン制御 | `chatService.parseRequest` の履歴整形部分 |
| 会話の保存先をDBに変更 | `chatService` から呼ぶ保存処理を新設し、`logger` と並べて呼ぶ |
| 新しいAPI(履歴一覧など) | `src/routes/` にルートを足し、`src/app.js` で登録 |
| 画面の見た目 | `public/style.css` |

## ログ

`logs/chat-YYYY-MM-DD.jsonl`(日付はローカル時間)に、1イベント1行で追記されます。
保存先は `.env` の `LOG_DIR` で変更できます。

| event | 内容 |
|---|---|
| `server_start` | 起動(provider, model) |
| `request` | ユーザーの入力、履歴の件数 |
| `response` | AIの返答全文、所要時間(`latencyMs`) |
| `aborted` | 停止ボタンや切断で中断(そこまでの返答 `partialReply`) |
| `error` | 失敗の詳細(画面には汎用メッセージのみ表示) |

見やすく確認するには:

```bash
tail -f logs/chat-*.jsonl
```

注意: **ログには会話の全文が入ります**。`logs/` と `.env` は `.gitignore` 済みなので、GitHub に上げないようにしてください。
Gemini APIの無料枠では、入力内容がGoogleの製品改善に使われる場合があります。個人情報は入力しないでください。
