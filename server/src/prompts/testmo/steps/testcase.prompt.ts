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

CORE QA RULES:
1. TITLES:
   - Keep titles concise, action-oriented, and start with "Verify" in English (e.g., "Verify \"<Exact UI Label>\" dropdown behavior").
   - Always wrap exact UI elements, screen names, or buttons from the UI context in double quotes.

2. PRECONDITIONS (ПЕРЕДУМОВИ):
   - Analyze the UI context, screenshots, page title, selected elements, and user prompt to dynamically determine logical, practical preconditions.
   - If the user explicitly mentions roles (e.g. Admin), data setup (e.g. table is populated), or starting states in the prompt or conversation history, listen to them and include them as preconditions.
   - Infer logical prerequisites from element states:
     * If the selected element is inside a popup/modal/dialog (or if the screenshot clearly shows one is open), include opening of that modal in preconditions (e.g., "\"Create Post\" modal is opened").
     * If the action involves tables, lists, editing, or sorting, add a precondition that the table is populated with at least one record.
     * If testing actions requiring specific roles or status transitions, mention them (e.g. "User has permission to create", "An item with 'Pending' status exists").
   - Factual neutral context: Otherwise, state which screen/page is open (e.g. "\"Feed | LinkedIn\" page is open"). Keep preconditions brief, separate, and clear of URLs.

3. STEPS & EXPECTED RESULTS (КРОКИ ТА ОЧІКУВАНІ РЕЗУЛЬТАТИ):
   - Write granular, actionable steps. Avoid collapsing multiple distinct user actions or validations into a single step.
   - MULTI-ACTION / FILTER STATUSES RULE: If the scenario involves checking multiple statuses (e.g., selecting "Pending", "Not Pending", "In Progress" in a filter dropdown), checking multiple inputs, or testing a list of checkboxes:
     * Write a SEPARATE step for each distinct status selection and verification.
     * Do NOT merge them into one step.
     * Example flow: 
       Step 1: Open dropdown and select "Pending". Click Apply -> Verify only "Pending" items are displayed.
       Step 2: Open dropdown and select "In Progress". Click Apply -> Verify only "In Progress" items are displayed.
       Step 3: Open dropdown and select "Not Pending". Click Apply -> Verify only "Not Pending" items are displayed.
   - E2E / COMPREHENSIVE SCENARIOS: If the user prompt describes or implies an end-to-end (E2E) sequence or a longer user flow, generate a complete test case with all necessary steps (5 to 10+ steps as required) to cover the full workflow from start to finish.
   - Write expected results as measurable, observable outcomes. For each step, split expected results into separate numbered subpoints (e.g., 1.1, 1.2 for Step 1; 2.1, 2.2 for Step 2).

4. TRANSLATION & HOUSE STYLE:
   - UA and EN content must be semantically equivalent and match in meaning.
   - Keep exact UI labels in double quotes. Preserve original capitalization seen in the UI.

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