import { MAX_TEST_CASES } from "../prompts/testmo/steps/testcase.prompt";
import { TestCase } from "../types/generate.types";
import { GenerateTestCasesInput } from "../validations/generate.validation";

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

export class LlmParserService {
  private STATIC_LABEL_TAGS = new Set([
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

  private STATIC_LABEL_HINTS = /(button|label|field|input|dropdown|select|checkbox|table|column|header|row|status|name|vehicle|driver|note|notes|save|edit|view|add|delete|search|filter|link|unlink|create|document|popup|dialog|modal|screen|page|title|tab|menu|breadcrumb)/iu;
  private DYNAMIC_DATA_HINTS = /(^\s*$|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b|\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b|\b[A-Z][a-z]+\d+\b|\b\d+[A-Za-z]+\b|@|https?:\/\/)/u;

  private DIALOG_WORDS_RE = /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu;
  private CLOSE_WORDS_RE = /(close|closed|dismiss|hidden|закри|закрит|зник|прихован)/iu;
  private OUTSIDE_CLICK_RE = /(outside|outside the boundaries|outside of|outside the pop-?up|поза межами|поза меж|поза попап|поза модал)/iu;
  private REOPEN_WORDS_RE = /(open|reopen|show|display|відкрий|відкрити|повторно|знову|показат)/iu;

  public parseOpenAiResponse(rawContent: string): { testCases: unknown[] } {
    const trimmed = rawContent.trim();

    const withoutFences = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    try {
      return JSON.parse(withoutFences) as { testCases: unknown[] };
    } catch {
      const start = withoutFences.indexOf("{");
      const end = withoutFences.lastIndexOf("}");

      if (start >= 0 && end > start) {
        return JSON.parse(withoutFences.slice(start, end + 1)) as { testCases: unknown[] };
      }

      throw new Error("OpenAI returned non-JSON content");
    }
  }

  public normalizeImageUrls(images?: unknown): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((image) => String(image || "").trim())
      .filter((image) => image.startsWith("data:image/") || /^https?:\/\//i.test(image));
  }

  public isUnsupportedImageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || "");
    return /unsupported image|invalid image|uploaded an unsupported image|image is valid/i.test(message);
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  private stripLinks(text: string): string {
    return String(text || "").trim();
  }

  private normalizeLine(value: string): string {
    return this.stripLinks(value)
      .replace(/^[-*•]\s*/u, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private hasStaticLabelEvidence(input: GenerateTestCasesInput): boolean {
    const html = String(input.html || "").toLowerCase();
    const tag = String(input.elementTag || "").toLowerCase();

    return (
      this.STATIC_LABEL_TAGS.has(tag) ||
      /aria-label\s*=|placeholder\s*=|role\s*=\s*"?(button|tab|menuitem|link|checkbox|switch|option|textbox|combobox)"?/iu.test(html) ||
      /<(th|label|button|legend|summary|h[1-6])\b/iu.test(html)
    );
  }

  private isLikelyDynamicDataText(text: string): boolean {
    const normalized = this.normalizeLine(text);

    if (!normalized) {
      return false;
    }

    if (this.DYNAMIC_DATA_HINTS.test(normalized)) {
      return true;
    }

    const words = normalized.split(/\s+/u).filter(Boolean);
    const titleCaseWords = words.filter((word) => /^[A-Z][a-z]+$/u.test(word)).length;

    return words.length >= 2 && titleCaseWords === words.length;
  }

  private isLikelyStaticUiLabel(text: string, input: GenerateTestCasesInput): boolean {
    const normalized = this.normalizeLine(text);

    if (!normalized) {
      return false;
    }

    if (input.elementLabel && normalized === this.normalizeLine(input.elementLabel)) {
      return true;
    }

    if (input.ariaLabel && normalized === this.normalizeLine(input.ariaLabel)) {
      return true;
    }

    if (input.placeholder && normalized === this.normalizeLine(input.placeholder)) {
      return true;
    }

    if (this.hasStaticLabelEvidence(input)) {
      return true;
    }

    if (this.STATIC_LABEL_HINTS.test(normalized)) {
      return true;
    }

    return !this.isLikelyDynamicDataText(normalized);
  }

  private getPrimaryUiLabel(input: GenerateTestCasesInput): string {
    const candidates = [input.elementLabel, input.ariaLabel, input.placeholder, input.selectedText]
      .map((value) => this.normalizeLine(String(value || "")))
      .filter((value) => value && this.isLikelyStaticUiLabel(value, input));

    return candidates[0] || "";
  }

  private quoteLabelInText(text: string, label: string): string {
    const normalizedText = String(text || "");
    const normalizedLabel = this.normalizeLine(label);

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
  }

  private normalizeScreenTitle(value: string): string {
    return this.stripLinks(String(value || ""))
      .replace(/\s*[-|]\s*TripLink\s*$/i, "")
      .replace(/^TripLink\s*[-|]\s*/i, "")
      .trim();
  }

  private pickInputText(input: GenerateTestCasesInput): string {
    return [input.userPrompt, input.pageTitle, input.selectedText, input.html]
      .map((value) => String(value || ""))
      .join(" \n")
      .toLowerCase();
  }

  private detectActionType(text: string): "create" | "edit" | "view" | "general" {
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
  }

  private hasPopupContext(text: string): boolean {
    return /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu.test(text);
  }

  private buildScreenContext(input: GenerateTestCasesInput): { ua: string; en: string } {
    const rawScreen = this.normalizeScreenTitle(String(input.pageTitle || input.selectedText || ""));

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
  }

  private buildPopupParagraph(input: GenerateTestCasesInput): { ua: string; en: string } {
    const text = this.pickInputText(input);
    const actionType = this.detectActionType(text);

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
  }

  private sanitizePreconditions(lines: string[], fallbackLine: string): string[] {
    const cleaned = lines
      .map((line) => this.normalizeLine(line))
      .filter(Boolean);

    if (cleaned.length === 0) {
      return [fallbackLine];
    }

    return cleaned;
  }

  private buildStructuredPreconditions(
    input: GenerateTestCasesInput,
    rawLines: string[],
    fallbackLine: string,
    language: "ua" | "en",
  ): string[] {
    const screenContext = this.buildScreenContext(input);
    const popup = this.buildPopupParagraph(input)[language];
    const contextText = this.pickInputText(input);
    const normalizedRaw = this.sanitizePreconditions(rawLines, fallbackLine)
      .map((line) => this.normalizeLine(line));

    const buckets = {
      screen: [] as string[],
      popup: [] as string[],
      other: [] as string[],
    };

    const screenPattern = /(screen|page|екран|сторінк)/iu;
    const popupPattern = /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu;

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

      if (this.hasPopupContext(contextText)) {
        fallbackResult.push(popup);
      }

      return fallbackResult;
    }

    const hasScreen = result.some((line) => screenPattern.test(line));
    const hasPopup = result.some((line) => popupPattern.test(line));

    if (!hasScreen) {
      result.push(language === "ua" ? screenContext.ua : screenContext.en);
    }

    if (this.hasPopupContext(this.pickInputText(input)) && !hasPopup) {
      result.push(popup);
    }

    return result;
  }

  private normalizeTitleWithUiLabel(title: string, input: GenerateTestCasesInput): string {
    const uiLabel = this.getPrimaryUiLabel(input);
    const normalized = String(title || "").trim();

    if (!normalized) {
      return uiLabel ? `Verify "${uiLabel}"` : "Verify generated test case";
    }

    return this.quoteLabelInText(normalized, uiLabel);
  }

  private ensureVerifyPrefix(title: string): string {
    const normalized = String(title || "").trim();

    if (!normalized) {
      return "Verify generated test case";
    }

    if (/^verify\b/i.test(normalized)) {
      return normalized;
    }

    return `Verify ${normalized}`;
  }

  private containsDialogCloseSignal(step: NormalizedStep): boolean {
    const stepText = `${step.step.ua} ${step.step.en}`;
    const expectedText = `${step.expectedResults.ua.join(" ")} ${step.expectedResults.en.join(" ")}`;
    const combined = `${stepText} ${expectedText}`;

    return this.DIALOG_WORDS_RE.test(combined) && this.CLOSE_WORDS_RE.test(combined);
  }

  private isOutsideCloseAction(step: NormalizedStep): boolean {
    const stepText = `${step.step.ua} ${step.step.en}`;
    return this.OUTSIDE_CLICK_RE.test(stepText);
  }

  private hasExplicitReopenAction(step: NormalizedStep): boolean {
    const stepText = `${step.step.ua} ${step.step.en}`;
    return this.DIALOG_WORDS_RE.test(stepText) && this.REOPEN_WORDS_RE.test(stepText);
  }

  private buildReopenPopupStep(): NormalizedStep {
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
  }

  private ensurePopupRecoverySteps(steps: NormalizedStep[]): NormalizedStep[] {
    if (steps.length < 2) {
      return steps;
    }

    const fixed: NormalizedStep[] = [steps[0]];

    for (let index = 1; index < steps.length; index += 1) {
      const previous = fixed[fixed.length - 1];
      const current = steps[index];

      const mustReopen =
        this.containsDialogCloseSignal(previous) &&
        this.isOutsideCloseAction(current) &&
        !this.hasExplicitReopenAction(current);

      if (mustReopen) {
        fixed.push(this.buildReopenPopupStep());
      }

      fixed.push(current);
    }

    return fixed;
  }

  public normalizeTestCasesFromOpenAi(rawCases: unknown, input: GenerateTestCasesInput): TestCase[] {
    if (!Array.isArray(rawCases)) {
      return [];
    }

    const screenContext = this.buildScreenContext(input);
    const uiLabel = this.getPrimaryUiLabel(input);

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
            ua: this.toStringArray(sourceExpected.ua),
            en: this.toStringArray(sourceExpected.en),
          },
        };
      });

      return {
        title: {
          ua: this.normalizeTitleWithUiLabel(String(sourceTitle.ua || `Тест-кейс ${caseIndex + 1}`).trim(), input),
          en: this.ensureVerifyPrefix(this.normalizeTitleWithUiLabel(String(sourceTitle.en || `generated test case ${caseIndex + 1}`).trim(), input)),
        },
        preconditions: {
          ua: this.buildStructuredPreconditions(input, this.toStringArray(sourcePre.ua), screenContext.ua, "ua").map((line) => this.quoteLabelInText(line, uiLabel)),
          en: this.buildStructuredPreconditions(input, this.toStringArray(sourcePre.en), screenContext.en, "en").map((line) => this.quoteLabelInText(line, uiLabel)),
        },
        steps: this.ensurePopupRecoverySteps(normalizedSteps).map((step) => ({
          step: {
            ua: this.quoteLabelInText(step.step.ua, uiLabel),
            en: this.quoteLabelInText(step.step.en, uiLabel),
          },
          expectedResults: {
            ua: step.expectedResults.ua.map((line) => this.quoteLabelInText(line, uiLabel)),
            en: step.expectedResults.en.map((line) => this.quoteLabelInText(line, uiLabel)),
          },
        })),
        priority: source.priority === "High" || source.priority === "Low" ? source.priority : "Medium",
        tags: this.toStringArray(source.tags),
      };
    });
  }
}
