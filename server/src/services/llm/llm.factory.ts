import { env } from "../../config/env";
import { LlmProvider } from "./llm-provider.interface";
import { OpenaiProvider } from "./openai.provider";
import { ClaudeProvider } from "./claude.provider";

export class LlmFactory {
  static getProvider(): LlmProvider {
    const llm = env.activeLlm;
    console.log(`[LLM FACTORY] Initializing provider for active LLM: ${llm}`);

    switch (llm) {
      case "anthropic":
      case "claude":
        return new ClaudeProvider();
      case "openai":
      default:
        return new OpenaiProvider();
    }
  }
}
