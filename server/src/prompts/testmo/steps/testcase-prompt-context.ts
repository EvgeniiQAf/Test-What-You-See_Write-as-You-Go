import { GenerateTestCasesInput } from "../validations/generate.validation";

export const buildUiLabelContext = (input: GenerateTestCasesInput): string => {
  return [
    `selectedText: ${input.selectedText || "N/A"}`,
    `elementLabel: ${input.elementLabel || "N/A"}`,
    `ariaLabel: ${input.ariaLabel || "N/A"}`,
    `placeholder: ${input.placeholder || "N/A"}`,
    `elementTag: ${input.elementTag || "N/A"}`,
  ].join("\n");
};

export const buildSelectedElementsContext = (input: GenerateTestCasesInput): string => {
  const selectedElements = Array.isArray((input as any).selectedElements) ? (input as any).selectedElements : [];

  if (selectedElements.length === 0) {
    return "N/A";
  }

  return selectedElements
    .map((item: any, index: number) => {
      const label = String(item?.text || item?.ariaLabel || item?.placeholder || "Element selected").trim();
      const tag = String(item?.tag || "element").trim();
      const screen = String(item?.pageTitle || input.pageTitle || "N/A").trim();
      return `${index + 1}. ${tag}: ${label} [${screen}]`;
    })
    .join("\n");
};

export const buildPreferenceNotesContext = (input: GenerateTestCasesInput): string => {
  const preferenceProfile = input.preferenceProfile || {};
  const preferenceNotes = (preferenceProfile.notes || [])
    .map((note) => String(note || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  if (preferenceNotes.length === 0) {
    return "- N/A";
  }

  return preferenceNotes.map((note) => `- ${note}`).join("\n");
};