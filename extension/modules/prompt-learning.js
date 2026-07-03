export function learnFromPrompt(userPrompt, getPreferenceProfile, savePreferenceProfile) {
  const text = String(userPrompt || "").toLowerCase();
  const profile = getPreferenceProfile();
  const intentNotes = [];

  if (text.includes("ua") && text.includes("en")) {
    profile.preferredLanguage = "ua-en";
  } else if (text.includes("тільки ua") || text.includes("only ua")) {
    profile.preferredLanguage = "ua";
  } else if (text.includes("тільки en") || text.includes("only en")) {
    profile.preferredLanguage = "en";
  }

  if (text.includes("verify")) {
    profile.prefersVerifyPrefix = true;
  }

  if (text.includes("без лінк") || text.includes("no link") || text.includes("screen")) {
    profile.prefersScreenContextPreconditions = true;
  }

  if (text.includes("в нашому стилі") || text.includes("our style") || text.includes("same style")) {
    const styleNote = "Use the bilingual UA/EN house style with matching meaning and exact UI labels.";
    profile.notes = Array.from(new Set([...(profile.notes || []), styleNote]));
  }

  if (/(\b1\b|one|один|одна|одне)\s+(super|big|large|single|main|full|comprehensive|великий|велика|єдиний|головний|повний)/iu.test(text)) {
    intentNotes.push("Treat '1 big/super test' as one comprehensive case.");
  }

  if (/(split|divide|break\s+into|розбий|поділи|розділи)/iu.test(text) && /\b\d{1,2}\b/u.test(text)) {
    intentNotes.push("Treat split/divide requests literally by the requested number of cases.");
  }

  if (/(main\s+regression|основн(і|і\s+)?регресійн(і|і\s+)?|core\s+regression|main\s+tests?)/iu.test(text)) {
    intentNotes.push("Prefer the smallest solid regression set for main regression requests.");
  }

  if (intentNotes.length > 0) {
    profile.notes = Array.from(new Set([...(profile.notes || []), ...intentNotes]));
  }

  const countMatch = text.match(/(\d{1,2})\s*(test|тест)/u);
  if (countMatch?.[1]) {
    const parsed = Number(countMatch[1]);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 10) {
      profile.maxCasesPreference = parsed;
    }
  }

  savePreferenceProfile(profile);
  return profile;
}

export function isLikelyTestRequest(text) {
  const normalized = String(text || "").toLowerCase();

  const explicitCountPattern = /\b\d{1,2}\s*(test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?|steps?|крок(и|ів)?|степ(и|ів)?)\b/u;
  if (explicitCountPattern.test(normalized)) {
    return true;
  }

  const testIntentPattern = /(зроби\s+.*тест|згенеруй\s+.*тест|test\s*plan|test\s*cases?|qa\s*test|тест(овий|ові)?\s+план|тести\s+для|tests?\s+for|for\s+this\s+block|for\s+this\s+element|на\s+твій\s+роздум|на\s+свій\s+розсуд)/iu;
  return testIntentPattern.test(normalized);
}
