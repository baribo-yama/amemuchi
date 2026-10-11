import { config } from "./src/config.js";
import { createLogger } from "./src/lib/logger.js";
import { createProvider } from "./src/providers/index.js";
import { createChatService } from "./src/services/chatService.js";
import { createApp } from "./src/app.js";

// 依存関係の組み立て(logger → provider → service → app)だけを行うエントリポイント
const logger = createLogger({ dir: config.logDir });
let provider;
try {
  provider = createProvider(config);
} catch (err) {
  // 設定ミス(APIキー未設定など)はスタックトレースではなく一行で伝える
  console.error(`起動できません: ${err.message}`);
  process.exit(1);
}
const chatService = createChatService({ provider, logger, config });
const app = createApp({ chatService, rootDir: config.rootDir });

app.listen(config.port, () => {
  logger.log("server_start", { port: config.port, provider: provider.name, model: provider.model });
  console.log(`http://localhost:${config.port}  (provider: ${provider.name}, model: ${provider.model})`);
  console.log(`ログ保存先: ${config.logDir}`);
});
