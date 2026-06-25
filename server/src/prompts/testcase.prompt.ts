import { GenerateTestCasesInput } from "../validations/generate.validation";

export const MAX_TEST_CASES = 10;

const countWordMap: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  один: 1,
  одна: 1,
  одне: 1,
  два: 2,
  дві: 2,
  три: 3,
  чотири: 4,
  "п'ять": 5,
  "п’ять": 5,
  шість: 6,
  сім: 7,
  вісім: 8,
  "дев'ять": 9,
  "дев’ять": 9,
  десять: 10,
};

const countTokenPattern = /(?:\b\d{1,2}\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\bодин\b|\bодна\b|\bодне\b|\bдва\b|\bдві\b|\bтри\b|\bчотири\b|\bп['’]ять\b|\bшість\b|\bсім\b|\bвісім\b|\bдев['’]ять\b|\bдесять\b)/iu;

const parseCountToken = (token: string): number | null => {
  const normalized = String(token || "").toLowerCase().replace(/[“”"']/g, "").trim();

  if (!normalized) {
    return null;
  }

  if (/^\d{1,2}$/.test(normalized)) {
    return Number(normalized);
  }

  return countWordMap[normalized] || null;
};

const normalizeScreenTitle = (value: string): string => {
  return String(value || "")
    .replace(/\s*[-|]\s*TripLink\s*$/i, "")
    .replace(/^TripLink\s*[-|]\s*/i, "")
    .trim();
};

const discretionaryRequestPattern = /(на\s+твій\s+роздум|на\s+свій\s+розсуд|for\s+this\s+block|for\s+this\s+section|for\s+this\s+element|зроби\s+для\s+цього\s+блоку|зроби\s+тести|згенеруй\s+тести|make\s+tests|create\s+tests|generate\s+tests)/iu;

const hasExplicitCount = (text: string): boolean => {
  return new RegExp(`${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")}\s*(?:test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?|steps?|крок(и|ів)?|степ(и|ів)?)`, "iu").test(text);
};

const oneTestRequestPattern = /(\b1\b\s*(super|single|big|main|overview|general|full|complete)?\s*(test|тест)|one\s+(super|single|big|main|full|complete)?\s*test|один\s+(супер|єдиний|головний|великий|повний)?\s*тест)/iu;

const countDistinctSignals = (text: string): number => {
  const signals = [
    /(popup|pop-up|modal|dialog|попап|модал|діалог|вікно)/iu,
    /(table|grid|list|card|row|column|таблиц|список|картк|рядок|колонк)/iu,
    /(create|add|new|створ|додат|новий|нова)/iu,
    /(edit|update|change|modify|редаг|змін|онов)/iu,
    /(view|open|show|details|перегляд|дивит|відкр)/iu,
    /(save|submit|confirm|ok|cancel|delete|close|apply|зберег|підтверд|видал|закри|скасув)/iu,
  ];

  return signals.reduce((count, regex) => (regex.test(text) ? count + 1 : count), 0);
};

export const inferRequestedCount = (input: GenerateTestCasesInput): number => {
  const promptText = String(input.userPrompt || "");
  const combinedText = [input.userPrompt, normalizeScreenTitle(input.pageTitle || ""), input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join("\n")
    .toLowerCase();
  const preferenceCap = Math.min(
    MAX_TEST_CASES,
    Math.max(1, Number(input.preferenceProfile?.maxCasesPreference || MAX_TEST_CASES)),
  );

  if (oneTestRequestPattern.test(combinedText)) {
    return 1;
  }

  const splitCountMatch = combinedText.match(
    new RegExp(`(?:split|divide|break\s+into|break\s+down|розбий|поділи|розділи)\s*(?:it\s+)?(?:into|in|на|to)?\s*(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})`, "iu"),
  );

  if (splitCountMatch?.[1]) {
    const splitCount = parseCountToken(splitCountMatch[1]);
    if (splitCount && splitCount > 0) {
      return Math.min(splitCount, MAX_TEST_CASES);
    }
  }

  if (/(main\s+regression|основн(і|і\s+)?регресійн(і|і\s+)?|core\s+regression|main\s+tests?)/iu.test(combinedText)) {
    return Math.min(3, MAX_TEST_CASES);
  }

  const alternativeCountMatch = combinedText.match(
    new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(?:чи|or|або)\s*(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})`, "iu"),
  );

  if (alternativeCountMatch?.[1] && alternativeCountMatch?.[2]) {
    const first = parseCountToken(alternativeCountMatch[1]);
    const second = parseCountToken(alternativeCountMatch[2]);
    const resolved = Math.max(first || 0, second || 0);

    if (resolved > 0) {
      return Math.min(resolved, MAX_TEST_CASES);
    }
  }

  const explicitCount = extractRequestedCount(promptText);
  const explicitCountDetected = hasExplicitCount(combinedText);

  if (!discretionaryRequestPattern.test(combinedText) || explicitCountDetected) {
    return explicitCount;
  }

  const complexitySignals = countDistinctSignals(combinedText);
  const labelSignals = [input.elementLabel, input.selectedText, input.ariaLabel, input.placeholder]
    .map((value) => String(value || "").trim())
    .filter(Boolean).length;

  const estimate = Math.max(1, Math.min(preferenceCap, Math.max(complexitySignals, labelSignals, 1)));

  return estimate;
};

export const extractRequestedCount = (prompt?: string): number => {
  const rawText = String(prompt || "");
  const text = rawText.toLowerCase();

  // NEW: Check for inline test markers: "Test 1:", "Test 2:", "Тест 1:", "Тест 2:"
  const inlineTestMatches = rawText.match(/(?:^|\n).*?(test|тест)\s*\d+(?:\s*[:\.])?/igu) || [];
  if (inlineTestMatches.length > 0) {
    const count = Math.min(inlineTestMatches.length, MAX_TEST_CASES);
    console.log(`[extractRequestedCount] Detected ${count} inline test markers`);
    return count;
  }

  const explicitPattern = new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?)`, "iu");
  const explicitMatch = text.match(explicitPattern);

  if (explicitMatch?.[1]) {
    const explicit = parseCountToken(explicitMatch[1]);
    if (Number.isInteger(explicit) && (explicit || 0) > 0) {
      const resolvedExplicit = explicit as number;
      return Math.min(resolvedExplicit, MAX_TEST_CASES);
    }
  }

  // If user explicitly asks for steps, do not treat that number as test case count.
  const explicitStepsPattern = new RegExp(`(${countTokenPattern.source.replace(/^\/(.*)\/[a-z]*$/u, "$1")})\s*(steps?|крок(и|ів)?|степ(и|ів)?)`, "iu");
  if (text.match(explicitStepsPattern)) {
    const numberedChecklistMatches = rawText.match(/^\s*\d+[\.)]\s+.+$/gmu) || [];
    if (numberedChecklistMatches.length > 0) {
      return Math.min(numberedChecklistMatches.length, MAX_TEST_CASES);
    }

    return MAX_TEST_CASES;
  }

  // If prompt has a top-level numbered checklist (1., 2., 3. ...), treat each line as separate test case.
  const numberedChecklistMatches = rawText.match(/^\s*\d+[\.)]\s+.+$/gmu) || [];
  if (numberedChecklistMatches.length > 0) {
    return Math.min(numberedChecklistMatches.length, MAX_TEST_CASES);
  }

  return MAX_TEST_CASES;
};

export const buildTestCasePrompt = (input: GenerateTestCasesInput): string => {
  const requestedCount = inferRequestedCount(input);
  const combinedText = [input.userPrompt, input.pageTitle, input.selectedText, input.html]
    .map((value) => String(value || ""))
    .join("\n")
    .toLowerCase();
  const singleComprehensiveMode = oneTestRequestPattern.test(combinedText);
  const compactHistory = (input.conversationHistory || [])
    .slice(-10)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
  const preferenceProfile = input.preferenceProfile || {};
  const preferenceNotes = (preferenceProfile.notes || [])
    .map((note) => String(note || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const uiLabelContext = [
    `selectedText: ${input.selectedText || "N/A"}`,
    `elementLabel: ${input.elementLabel || "N/A"}`,
    `ariaLabel: ${input.ariaLabel || "N/A"}`,
    `placeholder: ${input.placeholder || "N/A"}`,
    `elementTag: ${input.elementTag || "N/A"}`,
  ].join("\n");
  const selectedElements = Array.isArray((input as any).selectedElements) ? (input as any).selectedElements : [];
  const selectedElementsContext = selectedElements.length > 0
    ? selectedElements
      .map((item: any, index: number) => {
        const label = String(item?.text || item?.ariaLabel || item?.placeholder || "Element selected").trim();
        const tag = String(item?.tag || "element").trim();
        const screen = String(item?.pageTitle || input.pageTitle || "N/A").trim();
        return `${index + 1}. ${tag}: ${label} [${screen}]`;
      })
      .join("\n")
    : "N/A";

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
${preferenceNotes.length > 0 ? preferenceNotes.map((note) => `- ${note}`).join("\n") : "- N/A"}

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