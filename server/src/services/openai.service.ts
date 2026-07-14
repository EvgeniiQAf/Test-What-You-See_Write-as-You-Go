import {
  buildTestCasePrompt,
  MAX_TEST_CASES,
} from "../prompts/testmo/steps/testcase.prompt";
import { inferRequestedCount } from "../prompts/testmo/steps/testcase-counts";
import { TestCase } from "../types/generate.types";
import { GenerateTestCasesInput } from "../validations/generate.validation";
import {
  isUnsupportedImageError,
  normalizeImageUrls,
} from "./openai.vision";
import { parseOpenAiResponse } from "./openai.parser";
import { normalizeTestCasesFromOpenAi } from "./openai.formatting";
import { LlmFactory } from "./llm/llm.factory";
import { buildLlmMultimodalContent } from "./llm/llm.helper";
import { LlmMessage } from "./llm/llm.types";

export { buildMultimodalUserContent } from "./openai.vision";
export { generateClarificationReply, shouldAskForClarification } from "./openai.clarification";

interface OpenAiResponse {
  testCases: TestCase[];
}

export const generateTestCasesFromElement = async (
  input: GenerateTestCasesInput,
): Promise<{ testCases: TestCase[]; debug: { imagesReceived: number; imageMode: "vision" | "text-only" } }> => {
  const prompt = buildTestCasePrompt(input);
  const requestedCount = inferRequestedCount(input);
  const images = normalizeImageUrls((input as any).images);

  const callLlm = async (userPrompt: string, attachedImages: string[]) => {
    const provider = LlmFactory.getProvider();
    const messages: LlmMessage[] = [
      {
        role: "system",
        content: "You are a Senior QA Engineer. Return only valid JSON.",
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
    const parsed = parseOpenAiResponse(content);

    if (!Array.isArray(parsed.testCases)) {
      throw new Error("LLM JSON is missing testCases array");
    }

    return normalizeTestCasesFromOpenAi(parsed.testCases, input);
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
    if (images.length > 0 && isUnsupportedImageError(error)) {
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
};