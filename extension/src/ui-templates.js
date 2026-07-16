// UI Templates and Rendering helpers for QA Helper

const mainPanelHtml = `
  <div id="bgt-header" style="font-weight: 700; margin-bottom: 8px; cursor: move; user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
    <span style="flex: 1; font-size: 13px;">QA Helper</span>
    <div style="display: flex; gap: 6px; align-items: center;">
      <button id="bgt-toggle-settings" aria-label="Settings" style="
        border: 1px solid #d1d5db;
        background: #fff;
        color: #374151;
        border-radius: 6px;
        width: 24px;
        height: 24px;
        line-height: 20px;
        text-align: center;
        cursor: pointer;
        font-size: 12px;
        padding: 0;
        flex: 0 0 auto;
      ">⚙️</button>
      <button id="bgt-close" aria-label="Close helper" style="
        border: 1px solid #d1d5db;
        background: #fff;
        color: #374151;
        border-radius: 6px;
        width: 24px;
        height: 24px;
        line-height: 20px;
        text-align: center;
        cursor: pointer;
        font-size: 14px;
        padding: 0;
        flex: 0 0 auto;
      ">✕</button>
    </div>
  </div>

  <div id="bgt-settings-panel" style="
    display: none;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
    background: #f9fafb;
    font-size: 12px;
    flex-direction: column;
    gap: 8px;
  ">
    <div style="font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; display: flex; justify-content: space-between;">
      <span>Налаштування / Settings</span>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <label style="font-weight: 500; color: #374151;">Формат тестів / Format:</label>
      <select id="bgt-setting-format" style="width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #d1d5db; background: #fff; color: #1f2937;">
        <option value="steps">Classic Steps (Кроки та Очікувані результати)</option>
        <option value="bdd">BDD / Gherkin (Given / When / Then)</option>
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 4px;">
      <label style="font-weight: 500; color: #374151;">Мова генерації / Language:</label>
      <select id="bgt-setting-lang" style="width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #d1d5db; background: #fff; color: #1f2937;">
        <option value="default">Автовизначення / Default (detect)</option>
        <option value="ua">Тільки Українська / Ukrainian (UA)</option>
        <option value="en">Тільки Англійська / English (EN)</option>
        <option value="bilingual">Двомовний / Bilingual (UA & EN)</option>
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 4px;">
      <label style="font-weight: 500; color: #374151;">Модель ШІ / AI Engine:</label>
      <select id="bgt-setting-llm" style="width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #d1d5db; background: #fff; color: #1f2937;">
        <option value="default">За замовчуванням / Default active</option>
        <option value="openai">ChatGPT (OpenAI)</option>
        <option value="claude">Claude (Anthropic)</option>
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 4px;">
      <label style="font-weight: 500; color: #374151;">Кастомні правила / Custom rules:</label>
      <textarea id="bgt-setting-rules" placeholder="Наприклад: пиши кроки максимально лаконічно, без зайвих слів" style="
        width: 100%;
        height: 50px;
        box-sizing: border-box;
        padding: 4px;
        border-radius: 4px;
        border: 1px solid #d1d5db;
        resize: vertical;
        background: #fff;
        color: #1f2937;
      "></textarea>
    </div>
  </div>

  <div style="font-size: 12px; margin-bottom: 6px;">
    Shift + Click по елементу, щоб додати його до вибору
  </div>

  <div id="bgt-selected-element" style="
    font-size: 12px;
    background: #f3f4f6;
    color: #111827;
    padding: 8px;
    border-radius: 6px;
    margin-bottom: 10px;
    max-height: 80px;
    overflow: auto;
  ">
    No element selected
  </div>

  <div id="bgt-selected-screenshots" style="
    font-size: 12px;
    background: #f9fafb;
    color: #111827;
    padding: 8px;
    border-radius: 6px;
    margin-bottom: 10px;
    max-height: 180px;
    overflow: auto;
    border: 1px solid #e5e7eb;
  ">
    No screenshots selected
  </div>

  <div id="bgt-chat" style="
    height: auto;
    min-height: 160px;
    flex: 1 1 auto;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
    font-size: 12px;
    background: #ffffff;
  ">
    <div style="color:#6b7280;">Shift + Click element, then write prompt...</div>
  </div>

  <div id="bgt-status" style="
    font-size: 12px;
    margin-bottom: 8px;
    color: #6b7280;
  ">
    Status: idle
  </div>

  <textarea id="bgt-input" placeholder="Tasks: describe selected elements, then add Test 1:, Test 2: ..." style="
    width: 100%;
    height: 70px;
    box-sizing: border-box;
    padding: 8px;
    font-size: 12px;
    resize: vertical;
    margin-bottom: 8px;
  "></textarea>

  <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:12px; color:#374151; user-select:none; cursor:pointer;">
    <input id="bgt-generate-tests" type="checkbox" style="all:revert; display: inline-block !important; opacity: 1 !important; visibility: visible !important; width: 14px !important; height: 14px !important; margin: 0 !important; cursor: pointer !important; -webkit-appearance: checkbox !important; appearance: checkbox !important;" />
    Generate as test cases
  </label>
  
  <div id="bgt-test-mode-hint" style="font-size:12px; margin-bottom:8px; color:#6b7280;">
    Mode: chat
  </div>

  <div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
    <button id="bgt-add-test" style="
      flex: 1;
      padding: 8px;
      background: #ffffff;
      color: #1f2937;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
    ">Add Test Case #1</button>
  </div>

  <button id="bgt-send" style="
    width: 100%;
    padding: 8px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  ">
    Send
  </button>
`;

function addMessage(role, text, options = {}) {
  const shouldScroll = options.scroll !== false;
  const message = document.createElement("div");
  const chatBlock = document.getElementById("bgt-chat");

  message.style.marginBottom = "8px";
  message.style.padding = "6px";
  message.style.borderRadius = "6px";
  message.style.whiteSpace = "pre-wrap";
  message.style.background = role === "user" ? "#dbeafe" : "#f3f4f6";
  message.style.userSelect = "text";
  message.style.webkitUserSelect = "text";
  message.style.cursor = "text";
  message.textContent = text;

  if (chatBlock) {
    chatBlock.appendChild(message);
    if (shouldScroll) {
      chatBlock.scrollTop = chatBlock.scrollHeight;
    }
  }

  return message;
}

function renderTestCases(testCases) {
  window.renderedTestCases = Array.isArray(testCases) ? testCases : [];
  const chatBlock = document.getElementById("bgt-chat");
  if (!chatBlock) return;

  const existingCards = chatBlock.querySelectorAll("[data-test-case-card='true']");
  existingCards.forEach((node) => node.remove());

  window.renderedTestCases.forEach((testCase, index) => addTestCaseCard(testCase, index));
}

function addTestCaseCard(testCase, index) {
  const localTestCase = testCase;
  const chatBlock = document.getElementById("bgt-chat");
  if (!chatBlock) return;

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
    stepGroup.style.borderTop = "1px solid #e5e7eb";

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

    localTestCase.steps = stepEditors.map((editor, stepIndex) => ({
      step: {
        ua: String(editor.stepUaInput.value || `Крок ${stepIndex + 1}`).trim(),
        en: String(editor.stepEnInput.value || `Step ${stepIndex + 1}`).trim(),
      },
      expectedResults: {
        ua: splitExpectedText(editor.expectedUaInput.value),
        en: splitExpectedText(editor.expectedEnInput.value),
      },
    }));

    syncPreconditionsDisplay();
    editPanel.style.display = "none";
    editButton.textContent = "✎";
    editButton.title = "Edit preconditions";
    setStatus(`test #${index + 1} updated`, "#15803d");
    addMessage("assistant", `Saved edits for test #${index + 1}.`);
    renderTestCases(window.renderedTestCases);
  });

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.fontSize = "12px";

  const makeCell = (label, uaHtml, enHtml) => {
    const row = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.style.verticalAlign = "top";
    labelCell.style.padding = "4px";
    labelCell.style.fontWeight = "600";
    labelCell.style.width = "26%";
    labelCell.textContent = label;

    const uaCell = document.createElement("td");
    uaCell.style.verticalAlign = "top";
    uaCell.style.padding = "4px";
    uaCell.style.width = "37%";
    uaCell.innerHTML = uaHtml;

    const enCell = document.createElement("td");
    enCell.style.verticalAlign = "top";
    enCell.style.padding = "4px";
    enCell.style.width = "37%";
    enCell.innerHTML = enHtml;

    row.appendChild(labelCell);
    row.appendChild(uaCell);
    row.appendChild(enCell);
    table.appendChild(row);
  };

  makeCell(
    "UA / EN",
    "<strong>UA</strong>",
    "<strong>EN</strong>",
  );

  makeCell(
    "Title",
    `<strong>Назва:</strong> ${escapeHtml(localTestCase.title?.ua || "")}`,
    `<strong>Title:</strong> ${escapeHtml(localTestCase.title?.en || "")}`,
  );

  const preconditionsRow = document.createElement("tr");

  const preconditionsLabelCell = document.createElement("td");
  preconditionsLabelCell.style.verticalAlign = "top";
  preconditionsLabelCell.style.padding = "4px";
  preconditionsLabelCell.style.fontWeight = "600";
  preconditionsLabelCell.style.width = "26%";
  preconditionsLabelCell.textContent = "Preconditions";

  preconditionsRowCellUa = document.createElement("td");
  preconditionsRowCellUa.style.verticalAlign = "top";
  preconditionsRowCellUa.style.padding = "4px";
  preconditionsRowCellUa.style.width = "37%";

  preconditionsRowCellEn = document.createElement("td");
  preconditionsRowCellEn.style.verticalAlign = "top";
  preconditionsRowCellEn.style.padding = "4px";
  preconditionsRowCellEn.style.width = "37%";

  preconditionsRow.appendChild(preconditionsLabelCell);
  preconditionsRow.appendChild(preconditionsRowCellUa);
  preconditionsRow.appendChild(preconditionsRowCellEn);
  table.appendChild(preconditionsRow);

  syncPreconditionsDisplay();

  (localTestCase.steps || []).forEach((step, stepIndex) => {
    const formattedUaExpected = formatExpectedLines(step.expectedResults?.ua || [], stepIndex);
    const formattedEnExpected = formatExpectedLines(step.expectedResults?.en || [], stepIndex);

    makeCell(
      `Step ${stepIndex + 1}`,
      `<strong>Крок ${stepIndex + 1}:</strong><br />${escapeHtml(step.step?.ua || "")}`,
      `<strong>Step ${stepIndex + 1}:</strong><br />${escapeHtml(step.step?.en || "")}`,
    );

    makeCell(
      `Expected ${stepIndex + 1}`,
      `<strong>Очікуваний результат ${stepIndex + 1}:</strong><br />${formattedUaExpected.map((line) => escapeHtml(line)).join("<br />")}`,
      `<strong>Expected Result ${stepIndex + 1}:</strong><br />${formattedEnExpected.map((line) => escapeHtml(line)).join("<br />")}`,
    );
  });

  wrapper.appendChild(table);

  const actions = document.createElement("div");
  actions.style.marginTop = "8px";
  actions.style.display = "flex";
  actions.style.gap = "6px";

  const approveButton = document.createElement("button");
  approveButton.textContent = "Approve";
  approveButton.style.padding = "6px 10px";
  approveButton.style.border = "none";
  approveButton.style.borderRadius = "6px";
  approveButton.style.background = "#15803d";
  approveButton.style.color = "#fff";
  approveButton.style.cursor = "pointer";

  approveButton.addEventListener("click", async () => {
    approveButton.disabled = true;
    approveButton.textContent = "Approving...";

    try {
      if (!window.activeFolderId) {
        await loadTmsConfig();
      }

      if (!window.activeFolderId) {
        throw new Error(`Unable to load current ${window.activeTms} folder/suite identifier from server`);
      }

      const sequence = await getNextDraftSequence();
      const draft = {
        generated_case_id: sequence,
        case: localTestCase,
      };
      const formattedSeq = formatSequence(sequence);
      const fileName = `draft-${formattedSeq}.json`;

      await saveDraftJsonFile(fileName, draft);

      const createResponse = await fetch("http://localhost:3000/api/create-testcase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok || !createResult?.success) {
        const serverError = createResult?.error || `HTTP ${createResponse.status}`;
        throw new Error(`TMS create failed: ${serverError}`);
      }

      const storageKey = "bgt-approved-tms-drafts";
      const current = JSON.parse(localStorage.getItem(storageKey) || "[]");
      current.push(draft);
      localStorage.setItem(storageKey, JSON.stringify(current));

      const createdCaseId = createResult?.created?.id || "n/a";
      const usedFolderId = createResult?.folderId || "env";
      setStatus(`approved ${formattedSeq}, created in ${window.activeTms} (#${createdCaseId})`, "#15803d");
      addMessage("assistant", `Approved test #${index + 1}. Saved as ${fileName} and created in ${window.activeTms} case #${createdCaseId} (folder/suite ${usedFolderId}).`, { scroll: false });
      addMessage("assistant", JSON.stringify(draft, null, 2), { scroll: false });
      approveButton.textContent = `Approved #${formattedSeq}`;
    } catch (error) {
      console.error("Approve failed:", error);
      setStatus("approve failed", "#b91c1c");
      addMessage("assistant", `Failed to save approved draft: ${error.message || error}`, { scroll: false });
      approveButton.disabled = false;
      approveButton.textContent = "Approve";
    }
  });

  actions.appendChild(approveButton);
  wrapper.appendChild(actions);

  chatBlock.appendChild(wrapper);
}
