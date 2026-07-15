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
    let prompt = buildTestCasePrompt(input);

    if (input.format === "bdd") {
      prompt += `
\n\nCRITICAL BDD FORMATTING REQUIREMENT:
- You must write the preconditions and steps in BDD Gherkin format.
- Preconditions should be formulated as "Given ..." / "Дано ...".
- Steps should be formulated as "When ..." / "Коли ...".
- Expected results should be formulated as "Then ..." / "Тоді ...".
- Example step structure in JSON for BDD:
  "preconditions": {
    "ua": ["Дано користувач знаходиться на головній сторінці"],
    "en": ["Given the user is on the main page"]
  },
  "steps": [
    {
      "step": {
        "ua": "Коли користувач натискає на кнопку \"Увійти\"",
        "en": "When the user clicks the \"Login\" button"
      },
      "expectedResults": {
        "ua": ["Тоді користувач бачить панель управління", "Тоді відображається повідомлення про успішний вхід"],
        "en": ["Then the user sees the dashboard", "Then a successful login message is displayed"]
      }
    }
  ]
`;
    }

    if (input.language === "ua") {
      prompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: Generate all content fields ONLY in Ukrainian (UA). Even for English keys ("en"), write the Ukrainian translation or value.`;
    } else if (input.language === "en") {
      prompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: Generate all content fields ONLY in English (EN). Even for Ukrainian keys ("ua"), write the English translation or value.`;
    } else if (input.language === "bilingual") {
      prompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: Generate bilingual content - Ukrainian for "ua" keys, and English for "en" keys.`;
    }

    if (input.customInstructions) {
      prompt += `\n\nADDITIONAL CUSTOM USER RULES:\n${input.customInstructions}`;
    }

    const requestedCount = inferRequestedCount(input);
    const images = this.llmParser.normalizeImageUrls((input as any).images);

    const callLlm = async (userPrompt: string, attachedImages: string[]) => {
      const provider = LlmFactory.getProvider(input.preferredLlm);
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

    const providerName = LlmFactory.getProvider(input.preferredLlm).getLlmName();
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
