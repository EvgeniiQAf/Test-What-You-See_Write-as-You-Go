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

function openFloatingWindow(screenX, screenY) {
  hidePanel();
  chrome.runtime.sendMessage({
    type: "OPEN_FLOATING_WINDOW",
    screenX: screenX ?? (window.screenX + 100),
    screenY: screenY ?? (window.screenY + 100),
  });
}

function setupDragAndDrop(panelHeader, panel) {
  if (!panelHeader || !panel) return;

  const detachBtn = document.getElementById("bgt-detach-window");
  if (detachBtn) {
    detachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFloatingWindow(e.screenX, e.screenY);
    });
  }

  let autoDetached = false;

  panelHeader.addEventListener("mousedown", (event) => {
    if (event.target?.id === "bgt-detach-window" || event.target?.id === "bgt-close" || event.target?.id === "bgt-toggle-settings") return;
    isDragging = true;
    autoDetached = false;
    dragOffsetX = event.clientX - panel.offsetLeft;
    dragOffsetY = event.clientY - panel.offsetTop;
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const newLeft = event.clientX - dragOffsetX;
    const newTop = event.clientY - dragOffsetY;

    if (!autoDetached && (event.clientX < 15 || event.clientX > window.innerWidth - 15 || event.clientY < 15 || event.clientY > window.innerHeight - 15)) {
      autoDetached = true;
      isDragging = false;
      openFloatingWindow(event.screenX, event.screenY);
      return;
    }

    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function setupPresetListeners() {
  const presetsBar = document.getElementById("bgt-presets-bar");
  if (!presetsBar) return;

  const presetTexts = {
    table: "1 тест на всі колонки таблиці. Окремий крок та ОР для кожного стовпця.",
    dropdown: "Перевірити обрати декілька варіантів, диселект елемента та очищення через хрестик.",
    form: "Перевірити обов'язкові поля, валідацію форматів та помилки при некоректних даних.",
    edge: "Перевірити граничні значення (Min/Max length), спецсимволи та некоректне введення."
  };

  presetsBar.querySelectorAll(".bgt-preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("bgt-input");
      const key = btn.getAttribute("data-preset");
      const text = presetTexts[key];
      if (input && text) {
        input.value = input.value ? `${input.value}\n${text}` : text;
        input.focus();
      }
    });
  });
}

function renderEdgeCaseSuggestions() {
  const suggestionsBar = document.getElementById("bgt-suggestions-bar");
  if (!suggestionsBar) return;

  const elements = window.selectedElements || [];
  if (!elements.length) {
    suggestionsBar.innerHTML = "";
    return;
  }

  const latest = elements[elements.length - 1];
  const tag = String(latest.tag || "").toLowerCase();
  const html = String(latest.outerHTML || "").toLowerCase();
  const suggestions = [];

  if (tag === "table" || tag === "thead" || tag === "tbody" || html.includes("<table")) {
    suggestions.push({ label: "💡 Verify All Columns", text: "1 тест на всі колонки таблиці. Окремий крок та ОР для кожного стовпця." });
  }

  if (tag === "select" || html.includes("role=\"combobox\"") || html.includes("dropdown") || html.includes("select")) {
    suggestions.push({ label: "💡 Deselect & Clear", text: "Перевірити вибір декількох варіантів, зняття виділення елемента та закриття через хрестик." });
  }

  if (tag === "input" || tag === "textarea" || html.includes("required") || html.includes("maxlength") || html.includes("placeholder")) {
    suggestions.push({ label: "💡 Required Field", text: "Перевірити спробу відправки порожнього обов'язкового поля та виведення повідомлення про помилку." });
    suggestions.push({ label: "💡 Max Length / Boundary", text: "Перевірити граничні значення (Min/Max length) та введення неприпустимих спецсимволів." });
  }

  if (tag === "button" || tag === "a" || html.includes("role=\"button\"")) {
    suggestions.push({ label: "💡 Hover & Active State", text: "Перевірити відображення кнопки, стан при наведенні (hover), доступність (enabled) та клікабельність." });
  }

  if (!suggestions.length) {
    suggestions.push({ label: "💡 Standard Verification", text: "Перевірити відображення елемента, правильність назви та реакцію на взаємодію." });
  }

  suggestionsBar.innerHTML = suggestions
    .map(
      (s) => `<button type="button" class="bgt-suggestion-chip" data-suggestion-text="${escapeHtml(s.text)}" style="all:unset; cursor:pointer; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:500;">${escapeHtml(s.label)}</button>`
    )
    .join("");

  suggestionsBar.querySelectorAll(".bgt-suggestion-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("bgt-input");
      const textToAppend = btn.getAttribute("data-suggestion-text");
      if (input && textToAppend) {
        input.value = input.value ? `${input.value}\n${textToAppend}` : textToAppend;
        input.focus();
      }
    });
  });
}

function clearVisualSelectionBadges() {
  document.querySelectorAll(".bgt-selection-badge-overlay").forEach((badge) => badge.remove());
}

function updateVisualSelectionBadges() {
  clearVisualSelectionBadges();

  const nodes = window.selectedDomNodes || [];
  nodes.forEach((domNode, index) => {
    if (!domNode || !domNode.getBoundingClientRect) return;

    const rect = domNode.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const overlay = document.createElement("div");
    overlay.className = "bgt-selection-badge-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${Math.max(12, rect.width)}px`;
    overlay.style.height = `${Math.max(12, rect.height)}px`;
    overlay.style.border = "2px dashed #6366f1";
    overlay.style.borderRadius = "4px";
    overlay.style.boxShadow = "0 0 10px rgba(99, 102, 241, 0.5)";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483646";
    overlay.style.transition = "all 0.2s ease";

    const badge = document.createElement("span");
    badge.textContent = `${index + 1}`;
    badge.style.position = "absolute";
    badge.style.top = "-11px";
    badge.style.left = "-11px";
    badge.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
    badge.style.color = "#ffffff";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "bold";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "10px";
    badge.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
    badge.style.lineHeight = "1";

    overlay.appendChild(badge);
    document.body.appendChild(overlay);
  });
}

function renderSelectedElementsSummary() {
  updateVisualSelectionBadges();
  renderEdgeCaseSuggestions();

  const selectedElementBlock = document.getElementById("bgt-selected-element");
  if (!selectedElementBlock) return;

  if (!window.selectedElements.length) {
    selectedElementBlock.textContent = "Елементи не вибрано";
    clearVisualSelectionBadges();
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
