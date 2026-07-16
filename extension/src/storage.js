// LocalStorage and state persistence helpers for QA Helper

function loadConversationHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load conversation history:", error);
    return [];
  }
}

function saveConversationHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)));
  } catch (error) {
    console.warn("Failed to save conversation history:", error);
  }
}

function pushHistory(role, content) {
  window.conversationHistory = [...window.conversationHistory, {
    role,
    content: String(content || ""),
  }].slice(-MAX_HISTORY_ITEMS);

  saveConversationHistory(window.conversationHistory);
}

function getPreferenceProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;

    if (!parsed || typeof parsed !== "object") {
      return { ...defaultPreferenceProfile };
    }

    return {
      ...defaultPreferenceProfile,
      ...parsed,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [...defaultPreferenceProfile.notes],
    };
  } catch (error) {
    console.warn("Failed to load preference profile:", error);
    return { ...defaultPreferenceProfile };
  }
}

function savePreferenceProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Failed to save preference profile:", error);
  }
}

function getSavedSettings() {
  return {
    format: localStorage.getItem("bgt-setting-format") || "steps",
    lang: localStorage.getItem("bgt-setting-lang") || "default",
    llm: localStorage.getItem("bgt-setting-llm") || "default",
    rules: localStorage.getItem("bgt-setting-rules") || "",
  };
}

function saveSettings(settings) {
  localStorage.setItem("bgt-setting-format", settings.format);
  localStorage.setItem("bgt-setting-lang", settings.lang);
  localStorage.setItem("bgt-setting-llm", settings.llm);
  localStorage.setItem("bgt-setting-rules", settings.rules);
}

function applySavedSettingsToUi() {
  const settings = getSavedSettings();
  const settingFormat = document.getElementById("bgt-setting-format");
  const settingLang = document.getElementById("bgt-setting-lang");
  const settingLlm = document.getElementById("bgt-setting-llm");
  const settingRules = document.getElementById("bgt-setting-rules");

  if (settingFormat) settingFormat.value = settings.format;
  if (settingLang) settingLang.value = settings.lang;
  if (settingLlm) settingLlm.value = settings.llm;
  if (settingRules) settingRules.value = settings.rules;
}

function learnFromPrompt(userPrompt) {
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
