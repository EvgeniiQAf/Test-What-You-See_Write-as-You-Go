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
    .map((item) => {
      const content = String(item.content || "").trim();
      const truncated = content.length > 1000 ? content.slice(0, 1000) + "... (truncated)" : content;
      return `${item.role.toUpperCase()}: ${truncated}`;
    })
    .join("\n");

  const preferenceProfile = input.preferenceProfile || {};
  const preferenceNotes = buildPreferenceNotesContext(input);
  const uiLabelContext = buildUiLabelContext(input);
  const selectedElementsContext = buildSelectedElementsContext(input);
  
  const recordedActionsContext = (input.recordedActions || [])
    .map((action, idx) => {
      const timeStr = action.timestamp ? `[+${Math.round((action.timestamp - (input.recordedActions?.[0]?.timestamp || 0)) / 1000)}s]` : "";
      if (action.type === "click") {
        return `${idx + 1}. Click ${action.tag} "${action.label || ""}" (id: ${action.id || "N/A"}) at ${action.url || "N/A"} ${timeStr}`;
      } else if (action.type === "input") {
        return `${idx + 1}. Type in ${action.tag} "${action.label || ""}" value: "${action.value || ""}" at ${action.url || "N/A"} ${timeStr}`;
      }
      return `${idx + 1}. Action: ${action.type} on ${action.tag} "${action.label || ""}" at ${action.url || "N/A"} ${timeStr}`;
    })
    .join("\n");

    const rawHtml = String(input.html || "N/A").trim();
  const truncatedHtml = rawHtml.length > 3500 ? rawHtml.slice(0, 3500) + "... (truncated)" : rawHtml;

  return `
You are a Senior QA Engineer. Analyze the user request, page context, selected UI elements, recorded actions, and screenshots to generate high-quality, practical, human-like test cases.

Focus on deep analysis of what the user wants to test. Write clear, natural test titles, preconditions, steps, and expected results that accurately reflect real-world testing scenarios.

Output JSON Schema:
{
  "testCases": [
    {
      "title": {
        "ua": "Описовий та чіткий заголовок тесту українською мовою",
        "en": "Descriptive and clear test title in English"
      },
      "preconditions": {
        "ua": ["Необхідна передумова 1", "Необхідна передумова 2"],
        "en": ["Prerequisite 1", "Prerequisite 2"]
      },
      "steps": [
        {
          "step": {
            "ua": "Крок дії користувача українською",
            "en": "User action step in English"
          },
          "expectedResults": {
            "ua": ["Очікуваний результат або стан системи українською"],
            "en": ["Expected outcome or system response in English"]
          }
        }
      ],
      "priority": "Low | Medium | High",
      "tags": ["regression"]
    }
  ]
}

Return ONLY valid JSON matching the schema above. No markdown fences around JSON, no commentary.

Key Guidelines:
1. Analyze user intent deeply: If the user provides specific scenarios, edge cases, values, or validation rules in their message, incorporate them directly into logical steps and expected results.
2. Keep steps logical and actionable: Group related actions naturally or write step-by-step instructions that a QA engineer can follow effortlessly.
3. Make expected results measurable and specific: Describe visible UI changes, messages, redirects, or state updates rather than generic phrases.
4. Natural language support: Generate bilingual content (Ukrainian for "ua" fields, English for "en" fields) with matching semantic meaning.
5. PRECONDITIONS GENERALIZATION: DO NOT invent specific user names, specific email titles, specific dates, or hardcoded entity names unless explicitly provided in the user prompt. Use generic terms: "Any available email is opened" ("Відкрито будь-яке доступне повідомлення") or "Target page is loaded".
6. NO EXTENSION / SIDE PANEL MENTIONS: NEVER include "TWYS", "Side Panel", "QA Helper", or extension names in preconditions or steps! Preconditions must describe ONLY the target web application being tested.
7. QUOTING UI ELEMENTS & ENTITY NAMES: ALWAYS wrap UI component names, element titles, button labels, screen/page names, modal names, tab titles, and field names (e.g. "Person Paid", "Overview", "Billing Facility", "Submit") in double quotes (") in test titles, preconditions, step instructions, and expected results so they stand out clearly for QA engineers.

Requested test cases count: ${requestedCount}
Return exactly ${requestedCount} separate test case(s).

${singleComprehensiveMode ? `Single comprehensive test mode:
- Generate exactly 1 test case.
- Cover the entire flow in sequential steps inside this single test case.` : ""}

Context:
- User Prompt: ${input.userPrompt || "N/A"}
- Page Title: ${normalizeScreenTitle(input.pageTitle || "") || "N/A"}
- Page URL: ${input.url || "N/A"}
- Selected Text: ${input.selectedText || "N/A"}
- UI Element Context:
${uiLabelContext}
- Selected Elements List:
${selectedElementsContext}
- Recorded User Actions:
${recordedActionsContext || "N/A"}
- Additional Custom Instructions:
${input.customInstructions || "N/A"}
- Preference Notes:
${preferenceNotes}
- Recent Conversation History:
${compactHistory || "N/A"}
- HTML Snippet:
${truncatedHtml}
`;
};