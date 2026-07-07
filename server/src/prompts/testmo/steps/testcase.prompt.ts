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

Prompt structure rules:
- Treat the "Tasks:" block as shared context about the selected elements, their behavior, and the user intent.
- Treat each "Test N:" line as a separate test case objective.
- Build the title from the combination of the shared "Tasks:" context and the specific "Test N:" text.
- If the "Test N:" text is generic, infer a more precise title from the surrounding context instead of copying it verbatim.
- Keep the title concise, action-oriented, and traceable to the selected UI context.
- Do not lose the meaning of the user-written "Tasks:" description when forming titles or preconditions.
- If the user asks for one super test, one comprehensive test, or uses wording like "for all elements in the list", create exactly one broad test case that covers the whole list.
- In that situation, the title must describe the shared behavior of the full list or group, not one specific item from the end of the list.
- When the list contains many sortable/filterable controls from the same screen, prefer a screen-level title such as sorting across all fields on the screen.
- If multiple Shift+Click selections are present, treat the whole selection list as the source of truth and do not focus the title on the last clicked element.
- In composite selection mode, ignore the single-element bias from selectedText/elementLabel and derive the title from the whole list and the user intent.
- If attached photos are present, treat them as supporting evidence for the entire Tasks block and selected context, not only the last clicked element.
- For table sorting requests that mention all listed columns, generate one scenario with a screen-level sorting title and describe the sortable fields in preconditions or tasks, not as a single column title.

Follow the user request exactly.
Requested test cases count: ${requestedCount}
Return exactly ${requestedCount} separate test cases.

${singleComprehensiveMode ? `Single comprehensive test mode:
- Generate exactly 1 test case.
- Put all relevant selected objects, blocks, or UI states into that one case.
- Use multiple steps inside the single case instead of splitting into separate cases.
- The title must describe the whole block or flow, not each individual object.` : ""}

Canonical UI label rule:
- Copy any element name, field label, button label, screen label, or pop-up title verbatim from the UI context.
- Preserve the original capitalization exactly as seen in the screenshot or selected element text.
- If you mention a UI label, always wrap it in double quotes, for example: "Edit Vehicle", "Email", "Save".
- Do not guess or rename the control. Use the exact visible label, placeholder, aria-label, or selected text from the UI.
- If the label is not explicit, name the nearest explicit field/control from context instead of inventing a new one.
- Every title, step, and precondition must state which field/control is being checked.
- Do not use generic wording like button, field, pop-up, or modal without the exact quoted UI label.

Return ONLY valid JSON. No markdown, no commentary.

Output schema:
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

Rules:
- Keep UA and EN content semantically equivalent.
- Make steps and expected results specific and actionable.
- Each test case must be independent.
- If one step closes a pop-up/modal/dialog and the next step checks another close scenario (for example click outside), add an explicit recovery step to open/show the pop-up again before the next action.
- Keep formatting compact and clean.
- Prefer business-style QA wording.
- Write in a documentation style: precise, neutral, traceable, and easy to review.
Preference profile rules:
- Treat the saved preference profile as style guidance, not as new business logic.
- Treat user intent literally: "1 test" means one case, "1 big/super test" means one comprehensive case, "split into 3" means three cases, and "main regression tests" means the smallest solid regression set.
- If "prefersVerifyPrefix" is true, keep the title prefix "Verify".
- If "prefersScreenContextPreconditions" is true, mention the screen state explicitly in preconditions.
- If "expectedNumberingStyle" is set, keep step expected results numbered as subpoints.
- If user request is vague and does not specify a count, prefer no more than the saved "maxCasesPreference".
- If notes are present, apply them as short style constraints.

Preference notes:
${preferenceNotes}

Development rules:
- Do not invent business logic that is not visible in the UI, HTML, or user notes.
- Prefer one strong regression flow over many tiny duplicate cases.
- If a scenario is simple, keep the number of cases low and focus on the main happy path plus required validation.
- Keep preconditions factual and short; do not repeat the same fact in steps.
- When the user gives exact wording for a label or state, keep it verbatim.
- Keep the house style consistent: bilingual UA and EN must match in meaning, exact UI labels must stay in quotes, and the structure must stay compact and traceable.
- Treat selected element text as a UI label only when it is a static control label or column/header text; if it looks like a record value, person name, or other dynamic data, use it as context only and do not quote it as the label.

- Use a consistent title pattern: Verify "<exact UI label>" <action>.
- If the label is known, title must include the exact quoted UI label and the exact screen name when helpful.
- Use one user action per step whenever possible.
- Keep expected results observable and verifiable, not vague or opinion-based.
- Avoid generic wording such as correct, proper, valid, working, nice, or available unless the UI context makes them measurable.
- Avoid duplicated meaning across steps; each step should add a distinct action or state change.
- Prefer active verbs: open, select, enter, click, save, close, view, update, verify.
- If the user gives a wording for the starting state, keep that wording as a fact and do not paraphrase it into a different scenario.
- Do not invent prepared data lines. Include prepared-data preconditions only when the user explicitly mentions data setup or when the UI context clearly requires it.
- Default preconditions should be exact screen state first and exact pop-up/dialog state second when the scenario includes one.
- Preconditions must describe facts about the starting state, not instructions to the tester.
- When the UI has a visible label, placeholder, aria-label, or pop-up title, use the exact text from context and wrap it in double quotes.
- If the UI label contains mixed case, keep the case exactly as seen in the screenshot or selected text.
- If multiple controls could match, name the exact control from context and add the screen name to remove ambiguity.
- Title must describe the exact checked control and must include the exact quoted UI label.
- Step text must name the control being acted on or verified, using the exact quoted UI label.
- Preconditions must mention the exact checked screen, data, and pop-up state using quoted UI labels where applicable.
- Do not invent generic names; use documentation-style wording that is traceable to the UI.
- Write preconditions as separate paragraphs, one idea per paragraph.
- Use this order for preconditions whenever applicable: prepared test data, opened screen, opened pop-up/modal/dialog.
- If the scenario needs prepared data, state it in the first paragraph.
- If the scenario has a target screen, state it in the second paragraph.
- If the scenario needs a pop-up/modal/dialog, state it in the third paragraph.
- Do not mix prepared data, screen state, and pop-up state in one paragraph.
- For each step, expected results must be split into separate subpoints (for example 1.1, 1.2 for step 1; 2.1, 2.2 for step 2).
- English title must always start with the word "Verify".
- Maximum allowed test cases per response: ${MAX_TEST_CASES}.
- Preconditions must describe screen context (for example: "Driver - Add Vehicle screen is opened").
- Do NOT include URLs, links, or full web addresses in preconditions.
- If user provides a numbered checklist (1., 2., 3. ...), treat each top-level item as a separate test case by default.
- If user asks for N steps, keep it inside one test case unless user explicitly asks for N test cases.
- Test case count and step count are independent requirements.
- If user says "6 test cases" and also says "case 4 should have 3 steps", return exactly 6 cases and ensure case 4 has exactly 3 steps.
- If the user asks for "1 super test", "one big test", or a single comprehensive test for multiple selected objects, return exactly 1 test case and put all relevant objects into different steps inside that single case.

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

Recent conversation history:
${compactHistory || "N/A"}

HTML:
${input.html}
`;
};