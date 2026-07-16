import { GenerateTestCasesInput } from "../../../validations/generate.validation";
import { inferRequestedCount } from "./testcase-counts";
import { MAX_TEST_CASES } from "./testcase.constants";
import { isSingleComprehensiveRequest, normalizeScreenTitle } from "./testcase-context";
import {
  buildPreferenceNotesContext,
  buildSelectedElementsContext,
  buildUiLabelContext,
} from "./testcase-prompt-context";

export { MAX_TEST_CASES } from "./testcase.constants";


export const buildTestCasePrompt = (input: GenerateTestCasesInput): string => {
  const requestedCount = inferRequestedCount(input);
  const combinedText = [input.userPrompt, input.pageTitle, input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join("\n")
    .toLowerCase();
  const singleComprehensiveMode = isSingleComprehensiveRequest(combinedText);
  const compactHistory = (input.conversationHistory || [])
    .slice(-10)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
  const preferenceProfile = input.preferenceProfile || {};
  const preferenceNotes = buildPreferenceNotesContext(input);
  const uiLabelContext = buildUiLabelContext(input);
  const selectedElementsContext = buildSelectedElementsContext(input);

  return `
Generate QA test cases for the selected UI element in two languages: Ukrainian and English.

Output JSON Schema:
{
  "testCases": [
    {
      "title": {
        "ua": "Назва тесту українською з точним UI label у лапках",
        "en": "Test title in English with the exact UI label in quotes"
      },
      "preconditions": {
        "ua": ["..."],
        "en": ["..."]
      },
      "steps": [
        {
          "step": {
            "ua": "Крок 1 ...",
            "en": "Step 1 ..."
          },
          "expectedResults": {
            "ua": ["1.1 ...", "1.2 ..."],
            "en": ["1.1 ...", "1.2 ..."]
          }
        }
      ],
      "priority": "Low | Medium | High",
      "tags": ["regression"]
    }
  ]
}

Return ONLY valid JSON according to the schema above. No markdown wrap, no commentary.

PROFESSIONAL QA DOCUMENTATION STANDARDS & RULES:

1. TEST TITLES:
   - Must be concise, action-oriented, and describe the checked control under a specific condition.
   - Start with "Verify" in English (e.g., "Verify \"<Exact UI Label>\" dropdown behavior on \"<Screen Name>\" screen").
   - Always wrap exact UI elements, screen names, or buttons from the UI context in double quotes.

2. PRECONDITIONS (ПЕРЕДУМОВИ) - SYSTEM STATES, NOT ACTIONS:
   - Describe system states and facts required *before* the test starts. Never use action verbs or steps here (e.g., state "\"Create Post\" modal is opened", NOT "Open the 'Create Post' modal").
   - List each prerequisite separately (role/permissions, page context, target data state).
   - Analyze the UI context, screenshots, page title, selected elements, and user prompt to dynamically determine logical, practical preconditions:
     * If the selected element is inside a popup/modal/dialog (or if the screenshot shows one is open), include the active state of that modal (e.g., "\"Create Post\" modal is opened").
     * If the action involves tables, lists, editing, or sorting, add a precondition that target data exists (e.g., "Table contains at least one record").
     * If testing actions requiring specific roles or status transitions, mention them (e.g., "User is logged in with Admin permissions", "An item with 'Pending' status exists").
   - Factual neutral context: Otherwise, state which screen/page is open (e.g. "\"Feed | LinkedIn\" page is open"). Keep preconditions brief, separate, and clear of URLs.

3. TEST STEPS (КРОКИ) - IMPERATIVE ACTIVE VOICE:
   - Write steps in active, imperative voice:
     * English: Click, Enter, Select, Hover, Toggle, Verify (e.g., "Click \"Save\" button").
     * Ukrainian: Натисніть, Введіть, Оберіть, Наведіть курсор, Увімкніть, Перевірте (e.g., "Натисніть кнопку \"Зберегти\"").
   - Keep steps granular (exactly one logical user action per step). Avoid collapsing multiple distinct user actions into a single step.
   - DETECT UI LOGIC (Apply Button vs Auto-trigger): Analyze the selected element HTML and screenshot to verify if there is an explicit "Apply", "Save", "Submit", or "Filter" button:
     * If such a button exists, the step must include clicking it (e.g., "Select 'Pending' and click the 'Apply' button").
     * If NO such button exists, state that the action triggers automatically (e.g., "Select 'Pending' option from dropdown; the list is filtered automatically").
   - MULTI-SELECT, DESELECT, & CLEAR FLOWS: If the user mentions selecting multiple options, deselecting values, or clearing filters via a cross "x" mark:
     * Generate separate steps for each phase of interaction (e.g., Step 1: Select option A; Step 2: Select option B; Step 3: Deselect option A; Step 4: Click the "x" clear mark) to verify the UI updates correctly at each stage.
   - MULTI-ACTION / FILTER STATUSES RULE: If testing multiple dropdown statuses (e.g. "Pending", "In Progress", "Not Pending"), write a separate step for selecting and verifying each status sequentially.
   - E2E / COMPREHENSIVE SCENARIOS: If the user prompt describes or implies an E2E sequence or a longer user flow, generate a complete test case with all necessary steps (5 to 10+ steps as required) to cover the full workflow from start to finish.

4. EXPECTED RESULTS (ОЧІКУВАНІ РЕЗУЛЬТАТИ) - MEASURABLE OUTCOMES:
   - Describe the exact, observable state change of the system after the corresponding step action (e.g. visual elements displayed, page redirects, field highlights, active/disabled states).
   - Never use vague descriptions like "works correctly", "saves successfully", or "shown properly". Specify exactly what happens (e.g., "\"Changes saved\" toast message is displayed", "\"Submit\" button becomes disabled", "The page is redirected to \"Dashboard\"").
   - UA and EN content must be semantically equivalent and match in meaning.
   - Keep exact UI labels in double quotes. Preserve original capitalization seen in the UI.
   - For each step, expected results must be split into separate numbered subpoints (e.g., 1.1, 1.2 for Step 1; 2.1, 2.2 for Step 2).

Requested test cases count: ${requestedCount}
Return exactly ${requestedCount} separate test cases.

${singleComprehensiveMode ? `Single comprehensive test mode:
- Generate exactly 1 test case.
- Cover all selected objects or states with multiple sequential steps inside this single case instead of splitting into separate cases.
- The title must describe the overall flow or component.` : ""}

Page URL:
${input.url || "N/A"}

Page title / screen name:
${normalizeScreenTitle(input.pageTitle || "") || "N/A"}

Selected text:
${input.selectedText || "N/A"}

UI label context:
${uiLabelContext}

Shift+Click selections in order:
${selectedElementsContext}

User prompt:
${input.userPrompt || "N/A"}

Preference profile (persisted from prior chat turns):
${JSON.stringify(preferenceProfile, null, 2)}

Preference notes:
${preferenceNotes}

Recent conversation history:
${compactHistory || "N/A"}

HTML:
${input.html}
`;
};