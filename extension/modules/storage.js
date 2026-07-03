export const HISTORY_STORAGE_KEY = "bgt-conversation-history";
export const PROFILE_STORAGE_KEY = "bgt-preference-profile";
export const MAX_HISTORY_ITEMS = 20;

export const defaultPreferenceProfile = {
  preferredLanguage: "ua-en",
  prefersVerifyPrefix: true,
  prefersScreenContextPreconditions: true,
  expectedNumberingStyle: "step-subpoint",
  maxCasesPreference: 10,
  notes: ["Use the bilingual UA/EN house style with matching meaning and exact UI labels."],
};

export function loadConversationHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load conversation history:", error);
    return [];
  }
}

export function saveConversationHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)));
  } catch (error) {
    console.warn("Failed to save conversation history:", error);
  }
}

export function getPreferenceProfile() {
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

export function savePreferenceProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Failed to save preference profile:", error);
  }
}
