interface OpenAiResponse {
  testCases: unknown[];
}

export const parseOpenAiResponse = (rawContent: string): OpenAiResponse => {
  const trimmed = rawContent.trim();

  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFences) as OpenAiResponse;
  } catch {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1)) as OpenAiResponse;
    }

    throw new Error("OpenAI returned non-JSON content");
  }
};