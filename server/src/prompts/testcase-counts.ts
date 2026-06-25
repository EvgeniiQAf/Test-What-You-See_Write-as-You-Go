import { GenerateTestCasesInput } from "../validations/generate.validation";
import { MAX_TEST_CASES } from "./testcase.constants";

const countWordMap: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  один: 1,
  одна: 1,
  одне: 1,
  два: 2,
  дві: 2,
  три: 3,
  чотири: 4,
  "п'ять": 5,
  "п’ять": 5,
  шість: 6,
  сім: 7,
  вісім: 8,
  "дев'ять": 9,
  "дев’ять": 9,
  десять: 10,
};

const countTokenPattern = /(?:\b\d{1,2}\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\bодин\b|\bодна\b|\bодне\b|\bдва\b|\bдві\b|\bтри\b|\bчотири\b|\bп['’]ять\b|\bшість\b|\bсім\b|\bвісім\b|\bдев['’]ять\b|\bдесять\b)/iu;

const parseCountToken = (token: string): number | null => {
  const normalized = String(token || "").toLowerCase().replace(/[“”"']/g, "").trim();

  if (!normalized) {
    return null;
  }

  if (/^\d{1,2}$/.test(normalized)) {
    return Number(normalized);
  }

  return countWordMap[normalized] || null;
};

const normalizeScreenTitle = (value: string): string => {
  return String(value || "")
    .replace(/\s*[-|]\s*TripLink\s*$/i, "")
    .replace(/^TripLink\s*[-|]\s*/i, "")
    .trim();
};

const discretionaryRequestPattern = /(на\s+твій\s+роздум|на\s+свій\s+розсуд|for\s+this\s+block|for\s+this\s+section|for\s+this\s+element|зроби\s+для\s+цього\s+блоку|зроби\s+тести|згенеруй\s+тести|make\s+tests|create\s+tests|generate\s+tests)/iu;

const hasExplicitCount = (text: string): boolean => {
  return new RegExp(`${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")}\s*(?:test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?|steps?|крок(и|ів)?|степ(и|ів)?)`, "iu").test(text);
};

const oneTestRequestPattern = /(\b1\b\s*(super|single|big|main|overview|general|full|complete)?\s*(test|тест)|one\s+(super|single|big|main|full|complete)?\s*test|один\s+(супер|єдиний|головний|великий|повний)?\s*тест)/iu;

const countDistinctSignals = (text: string): number => {
  const signals = [
    /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu,
    /(table|grid|list|card|row|column|таблиц|список|картк|рядок|колонк)/iu,
    /(create|add|new|створ|додат|новий|нова)/iu,
    /(edit|update|change|modify|редаг|змін|онов)/iu,
    /(view|open|show|details|перегляд|дивит|відкр)/iu,
    /(save|submit|confirm|ok|cancel|delete|close|apply|зберег|підтверд|видал|закри|скасув)/iu,
  ];

  return signals.reduce((count, regex) => (regex.test(text) ? count + 1 : count), 0);
};

export const inferRequestedCount = (input: GenerateTestCasesInput): number => {
  const promptText = String(input.userPrompt || "");
  const combinedText = [input.userPrompt, normalizeScreenTitle(input.pageTitle || ""), input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join("\n")
    .toLowerCase();
  const preferenceCap = Math.min(
    MAX_TEST_CASES,
    Math.max(1, Number(input.preferenceProfile?.maxCasesPreference || MAX_TEST_CASES)),
  );

  if (oneTestRequestPattern.test(combinedText)) {
    return 1;
  }

  const splitCountMatch = combinedText.match(
    new RegExp(`(?:split|divide|break\s+into|break\s+down|розбий|поділи|розділи)\s*(?:it\s+)?(?:into|in|на|to)?\s*(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})`, "iu"),
  );

  if (splitCountMatch?.[1]) {
    const splitCount = parseCountToken(splitCountMatch[1]);
    if (splitCount && splitCount > 0) {
      return Math.min(splitCount, MAX_TEST_CASES);
    }
  }

  if (/(main\s+regression|основн(і|і\s+)?регресійн(і|і\s+)?|core\s+regression|main\s+tests?)/iu.test(combinedText)) {
    return Math.min(3, MAX_TEST_CASES);
  }

  const alternativeCountMatch = combinedText.match(
    new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(?:чи|or|або)\s*(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})`, "iu"),
  );

  if (alternativeCountMatch?.[1] && alternativeCountMatch?.[2]) {
    const first = parseCountToken(alternativeCountMatch[1]);
    const second = parseCountToken(alternativeCountMatch[2]);
    const resolved = Math.max(first || 0, second || 0);

    if (resolved > 0) {
      return Math.min(resolved, MAX_TEST_CASES);
    }
  }

  const explicitCount = extractRequestedCount(promptText);
  const explicitCountDetected = hasExplicitCount(combinedText);

  if (!discretionaryRequestPattern.test(combinedText) || explicitCountDetected) {
    return explicitCount;
  }

  const complexitySignals = countDistinctSignals(combinedText);
  const labelSignals = [input.elementLabel, input.selectedText, input.ariaLabel, input.placeholder]
    .map((value) => String(value || "").trim())
    .filter(Boolean).length;

  const estimate = Math.max(1, Math.min(preferenceCap, Math.max(complexitySignals, labelSignals, 1)));

  return estimate;
};

export const extractRequestedCount = (prompt?: string): number => {
  const rawText = String(prompt || "");
  const text = rawText.toLowerCase();

  const inlineTestMatches = rawText.match(/(?:^|\n).*?(test|тест)\s*\d+(?:\s*[:\.])?/igu) || [];
  if (inlineTestMatches.length > 0) {
    const count = Math.min(inlineTestMatches.length, MAX_TEST_CASES);
    console.log(`[extractRequestedCount] Detected ${count} inline test markers`);
    return count;
  }

  const explicitPattern = new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?)`);
  const explicitMatch = text.match(explicitPattern);

  if (explicitMatch?.[1]) {
    const explicit = parseCountToken(explicitMatch[1]);
    if (Number.isInteger(explicit) && (explicit || 0) > 0) {
      const resolvedExplicit = explicit as number;
      return Math.min(resolvedExplicit, MAX_TEST_CASES);
    }
  }

  const explicitStepsPattern = new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(steps?|крок(и|ів)?|степ(и|ів)?)`);
  if (text.match(explicitStepsPattern)) {
    const numberedChecklistMatches = rawText.match(/^\s*\d+[\.)]\s+.+$/gmu) || [];
    if (numberedChecklistMatches.length > 0) {
      return Math.min(numberedChecklistMatches.length, MAX_TEST_CASES);
    }

    return MAX_TEST_CASES;
  }

  const numberedChecklistMatches = rawText.match(/^\s*\d+[\.)]\s+.+$/gmu) || [];
  if (numberedChecklistMatches.length > 0) {
    return Math.min(numberedChecklistMatches.length, MAX_TEST_CASES);
  }

  return MAX_TEST_CASES;
};