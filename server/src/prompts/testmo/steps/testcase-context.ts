export const normalizeScreenTitle = (value: string): string => {
  const raw = String(value || "");
  if (/twys|side panel|qa helper/i.test(raw)) {
    return "";
  }
  return raw
    .replace(/\s*[-|]\s*(?:TripLink|TWYS QA Helper|Side Panel|TWYS)\s*$/i, "")
    .replace(/^(?:TripLink|TWYS QA Helper|Side Panel|TWYS)\s*[-|]\s*/i, "")
    .trim();
};

export const isSingleComprehensiveRequest = (text: string): boolean => {
  return /(\b1\b\s*(super|single|big|main|overview|general|full|complete)?\s*(test|тест)|one\s+(super|single|big|main|full|complete)?\s*test|один\s+(супер|єдиний|головний|великий|повний)?\s*тест)/iu.test(text);
};