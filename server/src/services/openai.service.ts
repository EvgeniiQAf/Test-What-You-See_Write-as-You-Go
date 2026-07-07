import { openai } from "../config/openai";
import {
  buildTestCasePrompt,
  MAX_TEST_CASES,
} from "../prompts/testmo/steps/testcase.prompt";
import { inferRequestedCount } from "../prompts/testmo/steps/testcase-counts";
import { TestCase } from "../types/generate.types";
import { GenerateTestCasesInput } from "../validations/generate.validation";
import {
  buildMultimodalUserContent,
  isUnsupportedImageError,
  normalizeImageUrls,
} from "./openai.vision";
import { parseOpenAiResponse } from "./openai.parser";
import { normalizeTestCasesFromOpenAi } from "./openai.formatting";

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

  const callOpenAi = async (userPrompt: string, attachedImages: string[]) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a Senior QA Engineer. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildMultimodalUserContent(userPrompt, attachedImages),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[OPENAI] Response received, parsing JSON...");
    const parsed = parseOpenAiResponse(content);

    if (!Array.isArray(parsed.testCases)) {
      throw new Error("OpenAI JSON is missing testCases array");
    }

    return normalizeTestCasesFromOpenAi(parsed.testCases, input);
  };

  console.log("[OPENAI] Calling API with model: gpt-4o");
  console.log("[OPENAI] Prompt length:", prompt.length, "chars");
  console.log("[OPENAI] Attached images:", images.length);

  try {
    let normalized = await callOpenAi(prompt, images);

    if (normalized.length !== requestedCount) {
      console.log(`[OPENAI] Count mismatch: got ${normalized.length}, need ${requestedCount}. Retrying once.`);

      normalized = await callOpenAi(`${prompt}\n\nCRITICAL: Return exactly ${requestedCount} test cases in testCases array.`, images);
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
      console.warn("[OPENAI] Image input was rejected, retrying without images.");
      const fallbackNormalized = await callOpenAi(`${prompt}\n\nCRITICAL: Return exactly ${requestedCount} test cases in testCases array.`, []);
      return {
        testCases: fallbackNormalized.slice(0, requestedCount),
        debug: {
          imagesReceived: images.length,
          imageMode: "text-only",
        },
      };
    }

    console.error("[OPENAI ERROR]", error instanceof Error ? error.message : error);
    throw error;
  }
};