# 飴モード / ムチモード 交互切り替え 実装プラン

## 目的

AIの返答を「飴(優しい)」→「ムチ(厳しい)」→「飴」→ … と、返答ごとに交互に切り替える。
飴モードの際には「あめむち.png」と「あめむち2.png」をモードに合わせて切り替えるようにする。この画像ファイルの名前は変更したほうがわかりやすい。

## 方針

プロンプトを2種類のtxtに分ける案(`prompts/飴.txt` / `prompts/ムチ.txt`)をそのまま採用する。
追加で、次の2点を決めた。

1. **モード判定はサーバー側で「履歴中の assistant メッセージ数の偶奇」から導出する(状態を持たない)**
   - 偶数(0, 2, 4…) → 飴 / 奇数 → ムチ
   - クライアントは毎回 `state.messages` 全件を送ってきている([public/1.js](../public/1.js))ので、新しい状態の保存は不要。
   - sessionId ごとの Map を持つ案は、再起動で消える・メモリが増える・複数サーバーで壊れるため採用しない。
   - 返答失敗・中断時は assistant が履歴に追加されない([public/1.js](../public/1.js) の `state.messages.push`)ため、モードも進まない。再送すると同じモードになる(これは望ましい挙動)。
2. **`prompts/system.txt` は共通ルールとして残し、モード別txtを後ろに連結して systemInstruction にする**
   - 「ユーザーの言語で答える」「わからないと正直に言う」等の共通指示を2ファイルに重複させない。

### 注意点: 偶奇は「切り詰め前」の履歴で数える

`parseRequest` は直近 `maxHistoryMessages`(既定20件)に切り詰める。
切り詰め後に数えると、履歴が長くなったときに偶奇がずれる。**必ず `slice` の前に数えること。**

## 触るファイル一覧

パスはリポジトリルート(`amemuchi/`)からの相対パス。

| 区分 | ファイル | 作業 |
|---|---|---|
| 新規 | `gemini-chat/prompts/飴.txt` | 優しい口調のプロンプトを書く |
| 新規 | `gemini-chat/prompts/ムチ.txt` | 厳しい口調のプロンプトを書く |
| 編集 | `gemini-chat/src/config.js` | モード別txtを読み込む |
| 編集 | `gemini-chat/src/services/chatService.js` | モード判定と systemInstruction の組み立て |
| 任意 | `gemini-chat/src/routes/chat.js` | モード通知イベントを送る場合のみ |
| 任意 | `gemini-chat/public/1.js` | モードを画面表示する場合のみ |
| 触らない | `gemini-chat/prompts/system.txt` | 共通ルールとしてそのまま残す |
| 触らない | `gemini-chat/src/providers/gemini.js`, `mock.js` | 変更不要 |

## 変更するファイルと内容

### 1. 新規: `gemini-chat/prompts/飴.txt`
優しく励ます口調の指示を書く。共通ルールは `system.txt` にあるので、口調・スタンスのみ記述する。

### 2. 新規: `gemini-chat/prompts/ムチ.txt`
厳しく指摘する口調の指示を書く。ファイル名は日本語でも動くが、環境差が心配なら `ame.txt` / `muchi.txt` にしてもよい(チームで決める)。

### 3. 編集: `gemini-chat/src/config.js`([開く](../src/config.js))
`systemPrompt` の読み込み部分を、`system.txt` + モード別txtの読み込みに変更する。

```js
const readPrompt = (name) => {
  const p = path.join(rootDir, "prompts", name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : "";
};

// ...
systemPrompt: readPrompt("system.txt"),
modePrompts: {
  ame: readPrompt("飴.txt"),
  muchi: readPrompt("ムチ.txt"),
},
```

### 4. 編集: `gemini-chat/src/services/chatService.js`([開く](../src/services/chatService.js))

`parseRequest`: slice の前にモードを決めて返す。

```js
const assistantCount = messages.filter((m) => m.role === "assistant").length;
const mode = assistantCount % 2 === 0 ? "ame" : "muchi";

return {
  sessionId: ...,
  mode,
  messages: messages.slice(-config.chat.maxHistoryMessages),
};
```

`streamReply`: 引数に `mode` を受け取り、systemInstruction を組み立て、ログにも `mode` を残す。

```js
async function* streamReply({ sessionId, mode, messages, signal }) {
  const base = { sessionId, mode, provider: provider.name, model: provider.model };
  // ...
  systemInstruction: [config.systemPrompt, config.modePrompts[mode]].filter(Boolean).join("\n\n"),
```

### 5. 任意: `gemini-chat/src/routes/chat.js`([開く](../src/routes/chat.js))
変更は不要(`...input` で `mode` がそのまま `streamReply` に渡る)。
フロントでモードを表示したい場合のみ、ストリーム開始時にイベントを1つ追加する。

```js
send({ type: "mode", mode: input.mode });   // for await の前
```

### 6. 任意: `gemini-chat/public/1.js`([開く](../public/1.js))
モードを画面表示したい場合のみ。 `type: "mode"` イベントを受け取り、`public/あめむち.png` 等の表示切り替えに使う。
今回のスコープ(AIの口調の切り替え)には含めない。必要になったら別タスクにする。

### 7. 触らない: `gemini-chat/src/providers/gemini.js`, `gemini-chat/src/providers/mock.js`
変更不要(`systemInstruction` を受け取るだけ)。

## 動作確認

- 1回目の返答が飴、2回目がムチ、3回目が飴になること。
- 返答を途中で停止して再送した場合、同じモードで返ること。
- 21件以上の履歴(切り詰めが発生する長さ)でも交互が崩れないこと。
- `logs/` に `mode` が記録されていること。
- `LLM_PROVIDER=mock` で、mock プロバイダーが受け取る `systemInstruction` にモード別txtの内容が含まれること。

## 担当分けの目安

- プロンプト文面(飴.txt / ムチ.txt): 文面担当
- config.js / chatService.js: バックエンド担当(30行以内の変更)
- フロント表示: 任意、別タスク
