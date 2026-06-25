import { openai } from "../config/openai";
import { GenerateTestCasesInput } from "../validations/generate.validation";

const pickInputText = (input: GenerateTestCasesInput): string => {
  return [input.userPrompt, input.pageTitle, input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join(" \n")
    .toLowerCase();
};

const hasContextSignals = (input: GenerateTestCasesInput): boolean => {
  return [input.pageTitle, input.selectedText, input.elementLabel, input.ariaLabel, input.placeholder]
    .map((value) => String(value || "").trim())
    .some(Boolean);
};

const isLowConfidenceTestRequest = (input: GenerateTestCasesInput): boolean => {
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

  if (!hasContextSignals(input) && wordCount <= 5 && !hasAction) {
    return true;
  }

  return false;
};

export const shouldAskForClarification = (input: GenerateTestCasesInput): boolean => {
  return isLowConfidenceTestRequest(input);
};

export const buildClarificationPrompt = (input: GenerateTestCasesInput): string => {
  const contextText = [input.pageTitle, input.selectedText, input.elementLabel, input.ariaLabel, input.placeholder]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ") || "N/A";

  return `
You are a helpful QA assistant.
The user wants test generation, but the request is too vague or looks like nonsense.
Ask exactly one short clarifying question in a natural chat style.
Do not generate test cases yet.
Keep the question concise and practical.

Current UI context: ${contextText}
User prompt: ${String(input.userPrompt || "")}
`.trim();
};

export const generateClarificationReply = async (input: GenerateTestCasesInput): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a helpful QA assistant. Ask one concise clarifying question and do not generate test cases.",
      },
      {
        role: "user",
        content: buildClarificationPrompt(input),
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "Please clarify the exact scenario you want tested.";
};