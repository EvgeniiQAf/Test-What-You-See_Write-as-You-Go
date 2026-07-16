// UI Interaction and Elements Manager for QA Helper

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function hidePanel() {
  const panelLayer = document.querySelector("div[style*='z-index: 2147483647']");
  const reopenButton = document.getElementById("bgt-reopen");
  if (panelLayer) panelLayer.style.display = "none";
  if (reopenButton) reopenButton.style.display = "block";
}

function showPanel() {
  const panelLayer = document.querySelector("div[style*='z-index: 2147483647']");
  const reopenButton = document.getElementById("bgt-reopen");
  const input = document.getElementById("bgt-input");
  if (panelLayer) panelLayer.style.display = "block";
  if (reopenButton) reopenButton.style.display = "none";
  if (input) input.focus();
}

function setupDragAndDrop(panelHeader, panel) {
  if (!panelHeader || !panel) return;

  panelHeader.addEventListener("mousedown", (event) => {
    isDragging = true;
    dragOffsetX = event.clientX - panel.offsetLeft;
    dragOffsetY = event.clientY - panel.offsetTop;
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    panel.style.left = `${event.clientX - dragOffsetX}px`;
    panel.style.top = `${event.clientY - dragOffsetY}px`;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function renderSelectedElementsSummary() {
  const selectedElementBlock = document.getElementById("bgt-selected-element");
  if (!selectedElementBlock) return;

  if (!window.selectedElements.length) {
    selectedElementBlock.textContent = "Елементи не вибрано";
    return;
  }

  const latest = window.selectedElements[window.selectedElements.length - 1];
  const summary = window.selectedElements
    .slice(-5)
    .map((item, index) => `${window.selectedElements.length - 4 + index > 0 ? `${window.selectedElements.length - 4 + index}. ` : ""}${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
    .join("\n");

  selectedElementBlock.textContent = `Задача:\n${summary}\n\nОстанній: ${latest.tag}: ${latest.text || latest.ariaLabel || latest.placeholder || "Елемент вибрано"}`;
}

function setStatus(text, color = "#6b7280") {
  const statusBlock = document.getElementById("bgt-status");
  if (statusBlock) {
    statusBlock.textContent = `Status: ${text}`;
    statusBlock.style.color = color;
  }
}

function updateAddTestButtonLabel() {
  const addTestButton = document.getElementById("bgt-add-test");
  if (addTestButton) {
    const displayNumber = Math.min(window.nextInlineTestNumber, MAX_TESTS);
    addTestButton.textContent = `Add Test Case #${displayNumber}`;
  }
}

function insertTestLabel() {
  const input = document.getElementById("bgt-input");
  if (!input) return;

  if (window.nextInlineTestNumber > MAX_TESTS) {
    setStatus("maximum 10 tests reached", "#b45309");
    addMessage("assistant", "Maximum 10 tests per prompt reached.");
    return;
  }

  const label = `Test ${window.nextInlineTestNumber}: `;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const needsNewLine = before.length > 0 && !before.endsWith("\n");
  const insertion = `${needsNewLine ? "\n" : ""}${label}`;

  input.value = `${before}${insertion}${after}`;
  const caretPosition = before.length + insertion.length;
  input.selectionStart = caretPosition;
  input.selectionEnd = caretPosition;

  addMessage("assistant", `Added ${label.trim()} marker.`);
  setStatus(`${label.trim()} inserted`, "#15803d");

  window.nextInlineTestNumber += 1;
  updateAddTestButtonLabel();
  input.focus();
}

function setTestModeHint(active, source = "manual") {
  const testModeHint = document.getElementById("bgt-test-mode-hint");
  const settingFormat = document.getElementById("bgt-setting-format");
  if (!testModeHint) return;

  if (!active) {
    testModeHint.textContent = "Mode: chat";
    testModeHint.style.color = "#6b7280";
    return;
  }

  const isBdd = settingFormat?.value === "bdd";
  const formatName = isBdd ? "BDD / Gherkin" : "test cases";

  testModeHint.textContent = source === "auto" ? `Mode: ${formatName} (auto-detected)` : `Mode: ${formatName}`;
  testModeHint.style.color = "#15803d";
}

function setRequestUiLocked(locked) {
  const sendButton = document.getElementById("bgt-send");
  const addTestButton = document.getElementById("bgt-add-test");
  const input = document.getElementById("bgt-input");
  
  if (sendButton) {
    sendButton.disabled = locked;
    sendButton.style.opacity = locked ? "0.65" : "1";
    sendButton.style.cursor = locked ? "not-allowed" : "pointer";
  }
  if (addTestButton) {
    addTestButton.disabled = locked;
    addTestButton.style.opacity = locked ? "0.65" : "1";
    addTestButton.style.cursor = locked ? "not-allowed" : "pointer";
  }
  if (input) {
    input.disabled = locked;
    input.style.opacity = locked ? "0.8" : "1";
  }
}
