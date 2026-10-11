import { createGeminiProvider } from "./gemini.js";
import { createMockProvider } from "./mock.js";

// プロバイダを増やすときはここに1行足すだけ
const factories = {
  gemini: (config) => createGeminiProvider(config.gemini),
  mock: () => createMockProvider(),
};

export function createProvider(config) {
  const factory = factories[config.provider];
  if (!factory) {
    const available = Object.keys(factories).join(", ");
    throw new Error(`未対応の LLM_PROVIDER: "${config.provider}"(使えるもの: ${available})`);
  }
  return factory(config);
}
