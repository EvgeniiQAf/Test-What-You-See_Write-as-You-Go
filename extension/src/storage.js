// LocalStorage and state persistence helpers for QA Helper

function loadConversationHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        const text = String(item.content || "").trim();
        return {
          ...item,
          content: text.length > 500 ? text.slice(0, 500) + "... (truncated)" : text,
        };
      });
    }
    return [];
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
  const textContent = String(content || "").trim();
  const cleaned = textContent.length > 500 ? textContent.slice(0, 500) + "... (truncated)" : textContent;
  window.conversationHistory = [...window.conversationHistory, {
    role,
    content: cleaned,
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

  const preconditionRegex = /(?:preconditions|передумови|передумова|precondition)\s*:\s*([\s\S]+?)(?=\n\n|\n\s*(?:test|тест|крок|step|напиши|згенеруй)\b|$)/iu;
  const preconditionMatch = userPrompt.match(preconditionRegex);
  if (preconditionMatch && preconditionMatch[1]) {
    const extracted = preconditionMatch[1].trim();
    localStorage.setItem("bgt-last-preconditions", extracted);
    console.log("[DEBUG] Stored persistent preconditions:", extracted);
  }

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

function saveSessionState() {
  try {
    const isPopupContext = window.location.protocol === "chrome-extension:";
    chrome.storage.local.get(["bgt-session-state"], (result) => {
      const existing = result?.["bgt-session-state"] || {};
      const input = document.getElementById("bgt-input");
      const rules = document.getElementById("bgt-setting-rules");
      
      const state = {
        selectedElements: window.selectedElements || [],
        selectedScreenshots: window.selectedScreenshots || [],
        conversationHistory: window.conversationHistory || [],
        nextInlineTestNumber: window.nextInlineTestNumber || 1,
        renderedTestCases: window.renderedTestCases || [],
        inputValue: isPopupContext && input ? input.value : (existing.inputValue || ""),
        rulesValue: isPopupContext && rules ? rules.value : (existing.rulesValue || "")
      };
      
      chrome.storage.local.set({ "bgt-session-state": state }, () => {
        console.log("[DEBUG] Session state saved to storage");
      });
    });
  } catch (error) {
    console.warn("Failed to save session state:", error);
  }
}

function loadSessionState() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["bgt-session-state"], (result) => {
        const state = result?.["bgt-session-state"];
        if (state) {
          window.selectedElements = state.selectedElements || [];
          window.selectedScreenshots = state.selectedScreenshots || [];
          window.conversationHistory = state.conversationHistory || [];
          window.nextInlineTestNumber = state.nextInlineTestNumber || 1;
          window.renderedTestCases = state.renderedTestCases || [];
          
          const input = document.getElementById("bgt-input");
          if (input && state.inputValue) {
            input.value = state.inputValue;
          }
          const rules = document.getElementById("bgt-setting-rules");
          if (rules && state.rulesValue) {
            rules.value = state.rulesValue;
          }
          console.log("[DEBUG] Session state loaded from storage");
          resolve(true);
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      console.warn("Failed to load session state:", error);
      resolve(false);
    }
  });
}

function clearSessionState() {
  try {
    window.selectedElements = [];
    window.selectedScreenshots = [];
    window.renderedTestCases = [];
    window.nextInlineTestNumber = 1;
    chrome.storage.local.remove(["bgt-session-state"], () => {
      console.log("[DEBUG] Session state cleared");
      
      // Notify active tab to clear outlines and badges
      try {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          if (tabs?.[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "CLEAR_HIGHLIGHTS" }).catch(() => {});
          }
        });
      } catch (e) {
        console.warn("Could not notify active tab to clear highlights", e);
      }
      
      // Broadcast update
      chrome.runtime.sendMessage({ type: "SELECTION_UPDATED" }).catch(() => {});
    });
  } catch (error) {
    console.warn("Failed to clear session state:", error);
  }
}
