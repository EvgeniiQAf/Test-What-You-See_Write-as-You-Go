export const normalizeScreenTitle = (value: string): string => {
  return String(value || "")
    .replace(/\s*[-|]\s*TripLink\s*$/i, "")
    .replace(/^TripLink\s*[-|]\s*/i, "")
    .trim();
};

export const isSingleComprehensiveRequest = (text: string): boolean => {
  return /(\b1\b\s*(super|single|big|main|overview|general|full|complete)?\s*(test|тест)|one\s+(super|single|big|main|full|complete)?\s*test|один\s+(супер|єдиний|головний|великий|повний)?\s*тест)/iu.test(text);
};