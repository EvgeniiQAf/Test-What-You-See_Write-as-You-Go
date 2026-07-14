import { GenerateTestCasesInput } from "../validations/generate.validation";
import { LLM_PROMPTS } from "../prompts/llm.prompts";
import { LlmFactory } from "./llm/llm.factory";
import { LlmMessage } from "./llm/llm.types";

export class ClarificationService {
  private hasContextSignals(input: GenerateTestCasesInput): boolean {
    return [input.pageTitle, input.selectedText, input.elementLabel, input.ariaLabel, input.placeholder]
      .map((value) => String(value || "").trim())
      .some(Boolean);
  }

  private isLowConfidenceTestRequest(input: GenerateTestCasesInput): boolean {
    const prompt = String(input.userPrompt || "").trim();
    const normalized = prompt.toLowerCase();
    const wordCount = prompt.split(/\s+/u).filter(Boolean).length;
    const hasAction = /(create|add|new|edit|update|change|modify|view|open|show|verify|check|test|тест|створ|додат|редаг|змін|онов|перегляд|відкр|перевір)/iu.test(normalized);
    const hasCountSignal = /\b\d{1,2}\b|\bone\b|\btwo\b|\bthree\b|\bодин\b|\bдва\b|\bтри\b/iu.test(normalized);
    const gibberishLike = /^(?:asdf+|qwe+|zxc+|test test|тест тест|.+\?{2,}|.+\.{4,})$/iu.test(normalized);

    if (!prompt) {
      return true;
    }

    if (gibberishLike) {
      return true;
    }

    if (wordCount <= 3 && !hasAction && !hasCountSignal) {
      return true;
    }

    if (!this.hasContextSignals(input) && wordCount <= 5 && !hasAction) {
      return true;
    }

    return false;
  }

  public shouldAskForClarification(input: GenerateTestCasesInput): boolean {
    return this.isLowConfidenceTestRequest(input);
  }

  public async generateClarificationReply(input: GenerateTestCasesInput): Promise<string> {
    const provider = LlmFactory.getProvider();
    const messages: LlmMessage[] = [
      {
        role: "system",
        content: LLM_PROMPTS.clarificationSystem,
      },
      {
        role: "user",
        content: LLM_PROMPTS.buildClarificationUserPrompt(input),
      },
    ];

    const content = await provider.chatCompletion(messages);
    return content.trim() || "Please clarify the exact scenario you want tested.";
  }
}
