import { inferRequestedCount } from "../prompts/testmo/steps/testcase-counts";
import { buildTestCasePrompt } from "../prompts/testmo/steps/testcase.prompt";
import { LLM_PROMPTS } from "../prompts/llm.prompts";
import { TestCase } from "../types/generate.types";
import { GenerateTestCasesInput } from "../validations/generate.validation";
import { LlmFactory } from "./llm/llm.factory";
import { buildLlmMultimodalContent } from "./llm/llm.helper";
import { LlmMessage } from "./llm/llm.types";
import { LlmParserService } from "./llm-parser.service";

export class TestCaseGeneratorService {
  constructor(private llmParser: LlmParserService) {}

  public async generateTestCases(
    input: GenerateTestCasesInput,
  ): Promise<{ testCases: TestCase[]; debug: { imagesReceived: number; imageMode: "vision" | "text-only" } }> {
    const prompt = buildTestCasePrompt(input);
    const requestedCount = inferRequestedCount(input);
    const images = this.llmParser.normalizeImageUrls((input as any).images);

    const callLlm = async (userPrompt: string, attachedImages: string[]) => {
      const provider = LlmFactory.getProvider();
      const messages: LlmMessage[] = [
        {
          role: "system",
          content: LLM_PROMPTS.testCaseSystem,
        },
        {
          role: "user",
          content: buildLlmMultimodalContent(userPrompt, attachedImages),
        },
      ];

      const content = await provider.chatCompletion(messages, {
        responseFormat: "json",
      });

      console.log(`[LLM] Response received from provider: ${provider.getLlmName()}, parsing JSON...`);
      const parsed = this.llmParser.parseOpenAiResponse(content);

      if (!Array.isArray(parsed.testCases)) {
        throw new Error("LLM JSON is missing testCases array");
      }

      return this.llmParser.normalizeTestCasesFromOpenAi(parsed.testCases, input);
    };

    const providerName = LlmFactory.getProvider().getLlmName();
    console.log(`[LLM] Calling API via provider: ${providerName}`);
    console.log("[LLM] Prompt length:", prompt.length, "chars");
    console.log("[LLM] Attached images:", images.length);

    try {
      let normalized = await callLlm(prompt, images);

      if (normalized.length !== requestedCount) {
        console.log(`[LLM] Count mismatch: got ${normalized.length}, need ${requestedCount}. Retrying once.`);

        normalized = await callLlm(`${prompt}\n\nCRITICAL: Return exactly ${requestedCount} test cases in testCases array.`, images);
      }

      return {
        testCases: normalized.slice(0, requestedCount),
        debug: {
          imagesReceived: images.length,
          imageMode: images.length > 0 ? "vision" : "text-only",
        },
      };
    } catch (error) {
      if (images.length > 0 && this.llmParser.isUnsupportedImageError(error)) {
        console.warn("[LLM] Image input was rejected, retrying without images.");
        const fallbackNormalized = await callLlm(`${prompt}\n\nCRITICAL: Return exactly ${requestedCount} test cases in testCases array.`, []);
        return {
          testCases: fallbackNormalized.slice(0, requestedCount),
          debug: {
            imagesReceived: images.length,
            imageMode: "text-only",
          },
        };
      }

      console.error("[LLM ERROR]", error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
