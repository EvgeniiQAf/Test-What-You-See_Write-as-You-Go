// Global State variables for QA Helper
window.highlightedElement = null;
window.selectedElementData = null;
window.selectedElements = [];
window.selectedScreenshot = null;
window.selectedScreenshots = [];
window.conversationHistory = [];
window.nextInlineTestNumber = 1;
window.isRequestInFlight = false;
window.renderedTestCases = [];
window.activeTms = "testmo";
window.activeFolderId = null;

const HISTORY_STORAGE_KEY = "bgt-conversation-history";
const PROFILE_STORAGE_KEY = "bgt-preference-profile";
const MAX_HISTORY_ITEMS = 20;
const MAX_TESTS = 10;
const MAX_SELECTED_SCREENSHOTS = 10;

const defaultPreferenceProfile = {
  preferredLanguage: "ua-en",
  prefersVerifyPrefix: true,
  prefersScreenContextPreconditions: true,
  expectedNumberingStyle: "step-subpoint",
  maxCasesPreference: 10,
  notes: ["Use the bilingual UA/EN house style with matching meaning and exact UI labels."],
};
