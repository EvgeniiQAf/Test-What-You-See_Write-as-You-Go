import { LlmCompletionOptions, LlmMessage } from "./llm.types";

export interface LlmProvider {
  getLlmName(): string;
  chatCompletion(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<string>;
}
