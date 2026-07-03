import {
  escapeHtml,
  priorityToCustomPriority,
  buildPreconditionsHtml,
  buildExpectedHtml,
  splitTextLines,
} from "./utils.js";

export function buildTestmoDraft(testCase, sequence, testmoFolderId) {
  return {
    generated_case_id: sequence,
    case: {
      folder_id: testmoFolderId || 0,
      name: testCase.title?.en || `Generated test case ${sequence}`,
      state_id: 5,
      template_id: 2,
      custom_priority: priorityToCustomPriority(testCase.priority),
      custom_description: buildPreconditionsHtml(testCase.preconditions?.en || []),
      custom_steps: (testCase.steps || []).map((step, stepIndex) => ({
        text1: `<p>${escapeHtml(step.step?.en || "")}</p>`,
        text3: buildExpectedHtml(step.expectedResults?.en || [], stepIndex),
      })),
    },
  };
}

export function addTestCaseCard(testCase, index, chatBlock) {
  const localTestCase = { ...testCase };
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-test-case-card", "true");
  wrapper.style.marginBottom = "10px";
  wrapper.style.padding = "8px";
  wrapper.style.border = "1px solid #e5e7eb";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "#f9fafb";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "8px";
  header.style.marginBottom = "6px";

  const heading = document.createElement("div");
  heading.style.fontWeight = "700";
  heading.textContent = `### ${localTestCase.title?.en || `Generated Test ${index + 1}`}`;

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "✎";
  editButton.title = "Edit preconditions";
  editButton.style.flex = "0 0 auto";
  editButton.style.width = "28px";
  editButton.style.height = "28px";
  editButton.style.border = "1px solid #d1d5db";
  editButton.style.borderRadius = "6px";
  editButton.style.background = "#ffffff";
  editButton.style.color = "#111827";
  editButton.style.cursor = "pointer";

  header.appendChild(heading);
  header.appendChild(editButton);

  const editPanel = document.createElement("div");
  editPanel.style.display = "none";
  editPanel.style.marginTop = "8px";
  editPanel.style.padding = "8px";
  editPanel.style.border = "1px solid #e5e7eb";
  editPanel.style.borderRadius = "8px";
  editPanel.style.background = "#ffffff";

  wrapper.appendChild(header);
  wrapper.appendChild(editPanel);

  const uaLabel = document.createElement("div");
  uaLabel.textContent = "UA preconditions";
  uaLabel.style.fontSize = "12px";
  uaLabel.style.fontWeight = "600";
  uaLabel.style.marginBottom = "4px";
  editPanel.appendChild(uaLabel);

  const uaInput = document.createElement("textarea");
  uaInput.style.width = "100%";
  uaInput.style.minHeight = "72px";
  uaInput.style.boxSizing = "border-box";
  uaInput.style.resize = "vertical";
  uaInput.style.marginBottom = "8px";
  uaInput.value = (localTestCase.preconditions?.ua || []).join("\n");
  editPanel.appendChild(uaInput);

  const enLabel = document.createElement("div");
  enLabel.textContent = "EN preconditions";
  enLabel.style.fontSize = "12px";
  enLabel.style.fontWeight = "600";
  enLabel.style.marginBottom = "4px";
  editPanel.appendChild(enLabel);

  const enInput = document.createElement("textarea");
  enInput.style.width = "100%";
  enInput.style.minHeight = "72px";
  enInput.style.boxSizing = "border-box";
  enInput.style.resize = "vertical";
  enInput.style.marginBottom = "8px";
  enInput.value = (localTestCase.preconditions?.en || []).join("\n");
  editPanel.appendChild(enInput);

  const stepEditors = (localTestCase.steps || []).map((step, stepIndex) => {
    const stepGroup = document.createElement("div");
    stepGroup.style.marginBottom = "12px";
    stepGroup.style.paddingTop = "8px";
    stepGroup.style.borderTop = stepIndex === 0 ? "1px solid #e5e7eb" : "1px solid #e5e7eb";

    const stepTitle = document.createElement("div");
    stepTitle.textContent = `Step ${stepIndex + 1}`;
    stepTitle.style.fontWeight = "700";
    stepTitle.style.marginBottom = "6px";
    stepGroup.appendChild(stepTitle);

    const stepUaLabel = document.createElement("div");
    stepUaLabel.textContent = "Step UA";
    stepUaLabel.style.fontSize = "12px";
    stepUaLabel.style.fontWeight = "600";
    stepUaLabel.style.marginBottom = "4px";
    stepGroup.appendChild(stepUaLabel);

    const stepUaInput = document.createElement("textarea");
    stepUaInput.style.width = "100%";
    stepUaInput.style.minHeight = "54px";
    stepUaInput.style.boxSizing = "border-box";
    stepUaInput.style.resize = "vertical";
    stepUaInput.style.marginBottom = "8px";
    stepUaInput.value = String(step.step?.ua || "");
    stepGroup.appendChild(stepUaInput);

    const stepEnLabel = document.createElement("div");
    stepEnLabel.textContent = "Step EN";
    stepEnLabel.style.fontSize = "12px";
    stepEnLabel.style.fontWeight = "600";
    stepEnLabel.style.marginBottom = "4px";
    stepGroup.appendChild(stepEnLabel);

    const stepEnInput = document.createElement("textarea");
    stepEnInput.style.width = "100%";
    stepEnInput.style.minHeight = "54px";
    stepEnInput.style.boxSizing = "border-box";
    stepEnInput.style.resize = "vertical";
    stepEnInput.style.marginBottom = "8px";
    stepEnInput.value = String(step.step?.en || "");
    stepGroup.appendChild(stepEnInput);

    const expectedUaLabel = document.createElement("div");
    expectedUaLabel.textContent = "Expected UA (one line per item)";
    expectedUaLabel.style.fontSize = "12px";
    expectedUaLabel.style.fontWeight = "600";
    expectedUaLabel.style.marginBottom = "4px";
    stepGroup.appendChild(expectedUaLabel);

    const expectedUaInput = document.createElement("textarea");
    expectedUaInput.style.width = "100%";
    expectedUaInput.style.minHeight = "62px";
    expectedUaInput.style.boxSizing = "border-box";
    expectedUaInput.style.resize = "vertical";
    expectedUaInput.style.marginBottom = "8px";
    expectedUaInput.value = (step.expectedResults?.ua || []).join("\n");
    stepGroup.appendChild(expectedUaInput);

    const expectedEnLabel = document.createElement("div");
    expectedEnLabel.textContent = "Expected EN (one line per item)";
    expectedEnLabel.style.fontSize = "12px";
    expectedEnLabel.style.fontWeight = "600";
    expectedEnLabel.style.marginBottom = "4px";
    stepGroup.appendChild(expectedEnLabel);

    const expectedEnInput = document.createElement("textarea");
    expectedEnInput.style.width = "100%";
    expectedEnInput.style.minHeight = "62px";
    expectedEnInput.style.boxSizing = "border-box";
    expectedEnInput.style.resize = "vertical";
    expectedEnInput.value = (step.expectedResults?.en || []).join("\n");
    stepGroup.appendChild(expectedEnInput);

    editPanel.appendChild(stepGroup);

    return {
      stepUaInput,
      stepEnInput,
      expectedUaInput,
      expectedEnInput,
    };
  });

  const editActions = document.createElement("div");
  editActions.style.display = "flex";
  editActions.style.gap = "6px";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.style.padding = "6px 10px";
  saveButton.style.border = "none";
  saveButton.style.borderRadius = "6px";
  saveButton.style.background = "#2563eb";
  saveButton.style.color = "#ffffff";
  saveButton.style.cursor = "pointer";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.padding = "6px 10px";
  cancelButton.style.border = "1px solid #d1d5db";
  cancelButton.style.borderRadius = "6px";
  cancelButton.style.background = "#ffffff";
  cancelButton.style.color = "#111827";
  cancelButton.style.cursor = "pointer";

  editActions.appendChild(saveButton);
  editActions.appendChild(cancelButton);
  editPanel.appendChild(editActions);

  wrapper.appendChild(editPanel);

  let preconditionsRowCellUa = null;
  let preconditionsRowCellEn = null;

  const syncPreconditionsDisplay = () => {
    if (!preconditionsRowCellUa || !preconditionsRowCellEn) {
      return;
    }

    preconditionsRowCellUa.innerHTML = `<strong>Preconditions:</strong><br />${(localTestCase.preconditions?.ua || []).map((line) => `- ${escapeHtml(line)}`).join("<br />")}`;
    preconditionsRowCellEn.innerHTML = `<strong>Preconditions:</strong><br />${(localTestCase.preconditions?.en || []).map((line) => `- ${escapeHtml(line)}`).join("<br />")}`;
  };

  editButton.addEventListener("click", () => {
    const isOpen = editPanel.style.display !== "none";
    editPanel.style.display = isOpen ? "none" : "block";
    editButton.textContent = isOpen ? "✎" : "✓";
    editButton.title = isOpen ? "Edit preconditions" : "Editing preconditions";
  });

  cancelButton.addEventListener("click", () => {
    uaInput.value = (localTestCase.preconditions?.ua || []).join("\n");
    enInput.value = (localTestCase.preconditions?.en || []).join("\n");
    editPanel.style.display = "none";
    editButton.textContent = "✎";
    editButton.title = "Edit preconditions";
  });

  saveButton.addEventListener("click", () => {
    localTestCase.preconditions = {
      ua: splitTextLines(uaInput.value),
      en: splitTextLines(enInput.value),
    };

    (localTestCase.steps || []).forEach((step, i) => {
      const editor = stepEditors[i];
      if (editor) {
        step.step.ua = editor.stepUaInput.value;
        step.step.en = editor.stepEnInput.value;
        step.expectedResults.ua = splitTextLines(editor.expectedUaInput.value);
        step.expectedResults.en = splitTextLines(editor.expectedEnInput.value);
      }
    });

    syncPreconditionsDisplay();
    editPanel.style.display = "none";
    editButton.textContent = "✎";
    editButton.title = "Edit preconditions";
  });

  chatBlock.appendChild(wrapper);
  chatBlock.scrollTop = chatBlock.scrollHeight;

  return {
    testCase: localTestCase,
    updateDisplay: syncPreconditionsDisplay,
  };
}
