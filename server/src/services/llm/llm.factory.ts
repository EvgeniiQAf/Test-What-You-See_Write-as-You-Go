import { env } from "../../config/env";
import { LlmProvider } from "./llm-provider.interface";
import { OpenaiProvider } from "./openai.provider";
import { ClaudeProvider } from "./claude.provider";

export class LlmFactory {
  static getProvider(override?: string): LlmProvider {
    const llm = override && override !== "default" ? override : env.activeLlm;
    console.log(`[LLM FACTORY] Initializing provider for active LLM: ${llm}${override && override !== "default" ? " (overridden by request)" : ""}`);

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
