import { openai } from "../config/openai";
import {
  buildTestCasePrompt,
  inferRequestedCount,
  MAX_TEST_CASES,
} from "../prompts/testcase.prompt";
import { TestCase } from "../types/generate.types";
import { GenerateTestCasesInput } from "../validations/generate.validation";
import {
  buildMultimodalUserContent,
  isUnsupportedImageError,
  normalizeImageUrls,
} from "./openai.vision";

export { buildMultimodalUserContent } from "./openai.vision";
export { generateClarificationReply, shouldAskForClarification } from "./openai.clarification";

interface OpenAiResponse {
  testCases: TestCase[];
}

interface NormalizedStep {
  step: {
    ua: string;
    en: string;
  };
  expectedResults: {
    ua: string[];
    en: string[];
  };
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const stripLinks = (text: string): string => {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const normalizeLine = (value: string): string => {
  return stripLinks(value)
    .replace(/^[-*•]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
};

const STATIC_LABEL_TAGS = new Set([
  "button",
  "label",
  "input",
  "textarea",
  "select",
  "option",
  "th",
  "summary",
  "a",
  "legend",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

const STATIC_LABEL_HINTS = /(button|label|field|input|dropdown|select|checkbox|table|column|header|row|status|name|vehicle|driver|note|notes|save|edit|view|add|delete|search|filter|link|unlink|create|document|popup|dialog|modal|screen|page|title|tab|menu|breadcrumb)/iu;

const DYNAMIC_DATA_HINTS = /(^\s*$|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b|\b[A-Z][a-z]+\d+\b|\b\d+[A-Za-z]+\b|@|https?:\/\/)/u;

const hasStaticLabelEvidence = (input: GenerateTestCasesInput): boolean => {
  const html = String(input.html || "").toLowerCase();
  const tag = String(input.elementTag || "").toLowerCase();

  return (
    STATIC_LABEL_TAGS.has(tag) ||
    /aria-label\s*=|placeholder\s*=|role\s*=\s*"?(button|tab|menuitem|link|checkbox|switch|option|textbox|combobox)"?/iu.test(html) ||
    /<(th|label|button|legend|summary|h[1-6])\b/iu.test(html)
  );
};

const isLikelyDynamicDataText = (text: string): boolean => {
  const normalized = normalizeLine(text);

  if (!normalized) {
    return false;
  }

  if (DYNAMIC_DATA_HINTS.test(normalized)) {
    return true;
  }

  const words = normalized.split(/\s+/u).filter(Boolean);
  const titleCaseWords = words.filter((word) => /^[A-Z][a-z]+$/u.test(word)).length;

  return words.length >= 2 && titleCaseWords === words.length;
};

const isLikelyStaticUiLabel = (text: string, input: GenerateTestCasesInput): boolean => {
  const normalized = normalizeLine(text);

  if (!normalized) {
    return false;
  }

  if (input.elementLabel && normalized === normalizeLine(input.elementLabel)) {
    return true;
  }

  if (input.ariaLabel && normalized === normalizeLine(input.ariaLabel)) {
    return true;
  }

  if (input.placeholder && normalized === normalizeLine(input.placeholder)) {
    return true;
  }

  if (hasStaticLabelEvidence(input)) {
    return true;
  }

  if (STATIC_LABEL_HINTS.test(normalized)) {
    return true;
  }

  return !isLikelyDynamicDataText(normalized);
};

const getPrimaryUiLabel = (input: GenerateTestCasesInput): string => {
  const candidates = [input.elementLabel, input.ariaLabel, input.placeholder, input.selectedText]
    .map((value) => normalizeLine(String(value || "")))
    .filter((value) => value && isLikelyStaticUiLabel(value, input));

  return candidates[0] || "";
};

const quoteLabelInText = (text: string, label: string): string => {
  const normalizedText = String(text || "");
  const normalizedLabel = normalizeLine(label);

  if (!normalizedLabel) {
    return normalizedText;
  }

  const quoted = `"${normalizedLabel}"`;
  if (normalizedText.includes(quoted)) {
    return normalizedText;
  }

  const pattern = new RegExp(`\\b${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!pattern.test(normalizedText)) {
    return normalizedText;
  }

  return normalizedText.replace(pattern, quoted);
};

const normalizeScreenTitle = (value: string): string => {
  return stripLinks(String(value || ""))
    .replace(/\s*[-|]\s*TripLink\s*$/i, "")
    .replace(/^TripLink\s*[-|]\s*/i, "")
    .trim();
};

const pickInputText = (input: GenerateTestCasesInput): string => {
  return [input.userPrompt, input.pageTitle, input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join(" \n")
    .toLowerCase();
};


const detectActionType = (text: string): "create" | "edit" | "view" | "general" => {
  if (/(create|add|new|створ|додат|новий|нова)/iu.test(text)) {
    return "create";
  }

  if (/(edit|update|change|modify|редаг|змін|онов)/iu.test(text)) {
    return "edit";
  }

  if (/(view|open|show|details|перегляд|дивит|відкр)/iu.test(text)) {
    return "view";
  }

  return "general";
};

const hasPopupContext = (text: string): boolean => {
  return /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu.test(text);
};

const buildPreparedDataParagraph = (input: GenerateTestCasesInput): { ua: string; en: string } => {
  const actionType = detectActionType(pickInputText(input));

  switch (actionType) {
    case "create":
      return {
        ua: "Підготовлені тестові дані для створення запису.",
        en: "Required test data for creating a record is prepared.",
      };
    case "edit":
      return {
        ua: "Підготовлений існуючий запис для редагування.",
        en: "An existing record is prepared for editing.",
      };
    case "view":
      return {
        ua: "Підготовлений запис для перегляду.",
        en: "A record is prepared for viewing.",
      };
    default:
      return {
        ua: "Підготовлені необхідні тестові дані для сценарію.",
        en: "Required test data is prepared for the scenario.",
      };
  }
};

const buildPopupParagraph = (input: GenerateTestCasesInput): { ua: string; en: string } => {
  const text = pickInputText(input);
  const actionType = detectActionType(text);

  if (actionType === "edit") {
    return {
      ua: "Відкрито поп-ап редагування.",
      en: "The edit pop-up is opened.",
    };
  }

  if (actionType === "create") {
    return {
      ua: "Відкрито поп-ап створення.",
      en: "The create pop-up is opened.",
    };
  }

  if (actionType === "view") {
    return {
      ua: "Відкрито поп-ап перегляду.",
      en: "The view pop-up is opened.",
    };
  }

  return {
    ua: "Відкрито відповідний поп-ап або модальне вікно, якщо це потрібно для сценарію.",
    en: "The relevant pop-up or modal dialog is opened if needed for the scenario.",
  };
};

const buildScreenContext = (input: GenerateTestCasesInput): { ua: string; en: string } => {
  const rawScreen = normalizeScreenTitle(String(input.pageTitle || input.selectedText || ""));

  if (!rawScreen) {
    return {
      ua: "Відкрито відповідний екран застосунку.",
      en: "Relevant application screen is opened.",
    };
  }

  return {
    ua: `Відкрито екран ${rawScreen}.`,
    en: `${rawScreen} screen is opened.`,
  };
};

const sanitizePreconditions = (lines: string[], fallbackLine: string): string[] => {
  const cleaned = lines
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (cleaned.length === 0) {
    return [fallbackLine];
  }

  return cleaned;
};

const buildStructuredPreconditions = (
  input: GenerateTestCasesInput,
  rawLines: string[],
  fallbackLine: string,
  language: "ua" | "en",
): string[] => {
  const screenContext = buildScreenContext(input);
  const popup = buildPopupParagraph(input)[language];
  const contextText = pickInputText(input);
  const normalizedRaw = sanitizePreconditions(rawLines, fallbackLine)
    .map((line) => normalizeLine(line));

  const buckets = {
    screen: [] as string[],
    popup: [] as string[],
    other: [] as string[],
  };

  const screenPattern = /(screen|page|екран|сторінк)/iu;
  const popupPattern = /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu;
  const preparedPattern = /(data|record|test data|тестов|дан|запис|підготов|existing|існую|settings|config|configuration|налаштуван|setup)/iu;

  normalizedRaw.forEach((line) => {
    if (popupPattern.test(line)) {
      buckets.popup.push(line);
      return;
    }

    if (screenPattern.test(line)) {
      buckets.screen.push(line);
      return;
    }

    buckets.other.push(line);
  });

  const ordered = [
    ...buckets.screen,
    ...buckets.popup,
    ...buckets.other,
  ];

  const result = Array.from(new Set(ordered.filter(Boolean)));

  if (result.length === 0) {
    const fallbackResult = [language === "ua" ? screenContext.ua : screenContext.en];

    if (hasPopupContext(contextText)) {
      fallbackResult.push(popup);
    }

    return fallbackResult;
  }

  const hasScreen = result.some((line) => screenPattern.test(line));
  const hasPopup = result.some((line) => popupPattern.test(line));

  if (!hasScreen) {
    result.push(language === "ua" ? screenContext.ua : screenContext.en);
  }

  if (hasPopupContext(pickInputText(input)) && !hasPopup) {
    result.push(popup);
  }

  return result;
};

const normalizeTitleWithUiLabel = (title: string, input: GenerateTestCasesInput): string => {
  const uiLabel = getPrimaryUiLabel(input);
  const normalized = String(title || "").trim();

  if (!normalized) {
    return uiLabel ? `Verify "${uiLabel}"` : "Verify generated test case";
  }

  return quoteLabelInText(normalized, uiLabel);
};

const ensureVerifyPrefix = (title: string): string => {
  const normalized = String(title || "").trim();

  if (!normalized) {
    return "Verify generated test case";
  }

  if (/^verify\b/i.test(normalized)) {
    return normalized;
  }

  return `Verify ${normalized}`;
};

const DIALOG_WORDS_RE = /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu;
const CLOSE_WORDS_RE = /(close|closed|dismiss|hidden|закри|закрит|зник|прихован)/iu;
const OUTSIDE_CLICK_RE = /(outside|outside the boundaries|outside of|outside the pop-?up|поза межами|поза меж|поза попап|поза модал)/iu;
const REOPEN_WORDS_RE = /(open|reopen|show|display|відкрий|відкрити|повторно|знову|показат)/iu;

const containsDialogCloseSignal = (step: NormalizedStep): boolean => {
  const stepText = `${step.step.ua} ${step.step.en}`;
  const expectedText = `${step.expectedResults.ua.join(" ")} ${step.expectedResults.en.join(" ")}`;
  const combined = `${stepText} ${expectedText}`;

  return DIALOG_WORDS_RE.test(combined) && CLOSE_WORDS_RE.test(combined);
};

const isOutsideCloseAction = (step: NormalizedStep): boolean => {
  const stepText = `${step.step.ua} ${step.step.en}`;
  return OUTSIDE_CLICK_RE.test(stepText);
};

const hasExplicitReopenAction = (step: NormalizedStep): boolean => {
  const stepText = `${step.step.ua} ${step.step.en}`;
  return DIALOG_WORDS_RE.test(stepText) && REOPEN_WORDS_RE.test(stepText);
};

const buildReopenPopupStep = (): NormalizedStep => {
  return {
    step: {
      ua: "Відкрити поп-ап повторно.",
      en: "Open the pop-up again.",
    },
    expectedResults: {
      ua: ["Поп-ап відображається на екрані."],
      en: ["The pop-up is displayed on the screen."],
    },
  };
};

const ensurePopupRecoverySteps = (steps: NormalizedStep[]): NormalizedStep[] => {
  if (steps.length < 2) {
    return steps;
  }

  const fixed: NormalizedStep[] = [steps[0]];

  for (let index = 1; index < steps.length; index += 1) {
    const previous = fixed[fixed.length - 1];
    const current = steps[index];

    const mustReopen =
      containsDialogCloseSignal(previous) &&
      isOutsideCloseAction(current) &&
      !hasExplicitReopenAction(current);

    if (mustReopen) {
      fixed.push(buildReopenPopupStep());
    }

    fixed.push(current);
  }

  return fixed;
};

const normalizeTestCases = (rawCases: unknown, input: GenerateTestCasesInput): TestCase[] => {
  if (!Array.isArray(rawCases)) {
    return [];
  }

  const screenContext = buildScreenContext(input);

  return rawCases.slice(0, MAX_TEST_CASES).map((rawCase, caseIndex) => {
    const source = (rawCase || {}) as any;
    const sourceTitle = source.title || {};
    const sourcePre = source.preconditions || {};
    const sourceSteps = Array.isArray(source.steps) ? source.steps : [];

    const normalizedSteps: NormalizedStep[] = sourceSteps.map((rawStep: any, stepIndex: number) => {
      const sourceStep = rawStep?.step || {};
      const sourceExpected = rawStep?.expectedResults || {};

      return {
        step: {
          ua: String(sourceStep.ua || `Крок ${stepIndex + 1}`).trim(),
          en: String(sourceStep.en || `Step ${stepIndex + 1}`).trim(),
        },
        expectedResults: {
          ua: toStringArray(sourceExpected.ua),
          en: toStringArray(sourceExpected.en),
        },
      };
    });

    return {
      title: {
        ua: normalizeTitleWithUiLabel(String(sourceTitle.ua || `Тест-кейс ${caseIndex + 1}`).trim(), input),
        en: ensureVerifyPrefix(normalizeTitleWithUiLabel(String(sourceTitle.en || `generated test case ${caseIndex + 1}`).trim(), input)),
      },
      preconditions: {
        ua: buildStructuredPreconditions(input, toStringArray(sourcePre.ua), screenContext.ua, "ua").map((line) => quoteLabelInText(line, getPrimaryUiLabel(input))),
        en: buildStructuredPreconditions(input, toStringArray(sourcePre.en), screenContext.en, "en").map((line) => quoteLabelInText(line, getPrimaryUiLabel(input))),
      },
      steps: ensurePopupRecoverySteps(normalizedSteps).map((step) => ({
        step: {
          ua: quoteLabelInText(step.step.ua, getPrimaryUiLabel(input)),
          en: quoteLabelInText(step.step.en, getPrimaryUiLabel(input)),
        },
        expectedResults: {
          ua: step.expectedResults.ua.map((line) => quoteLabelInText(line, getPrimaryUiLabel(input))),
          en: step.expectedResults.en.map((line) => quoteLabelInText(line, getPrimaryUiLabel(input))),
        },
      })),
      priority: source.priority === "High" || source.priority === "Low" ? source.priority : "Medium",
      tags: toStringArray(source.tags),
    };
  });
};

const parseOpenAiResponse = (rawContent: string): OpenAiResponse => {
  const trimmed = rawContent.trim();

  // Handle markdown fenced output like ```json ... ```.
  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFences) as OpenAiResponse;
  } catch {
    // Fallback: extract the first JSON object region.
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1)) as OpenAiResponse;
    }

    throw new Error("OpenAI returned non-JSON content");
  }
};

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

    return normalizeTestCases(parsed.testCases, input);
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