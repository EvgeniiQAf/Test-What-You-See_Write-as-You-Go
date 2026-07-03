import {
  loadConversationHistory,
  saveConversationHistory,
  getPreferenceProfile,
  savePreferenceProfile,
  MAX_HISTORY_ITEMS,
} from "./modules/storage.js";
import { learnFromPrompt, isLikelyTestRequest } from "./modules/prompt-learning.js";
import { createPanel, setupPanelEvents, addMessage as addMessageToChat, setRequestUiLocked as setUiLock } from "./modules/ui.js";
import {
  escapeHtml,
  normalizeSelectionItem,
  normalizeSelectionList,
  normalizeScreenshotList,
  compressScreenshotDataUrl,
  formatSequence,
} from "./modules/utils.js";
import { getNextDraftSequence, saveDraftJsonFile, sendRuntimeMessage } from "./modules/runtime.js";
import { buildTestmoDraft, addTestCaseCard as addCard } from "./modules/testmo.js";

console.log("Browser GPT Testmo Helper loaded");

let highlightedElement = null;
let selectedElements = [];
let selectedScreenshots = [];
let conversationHistory = [];
let nextInlineTestNumber = 1;
let isRequestInFlight = false;
let renderedTestCases = [];
let testmoFolderId = null;

const MAX_TESTS = 10;
const MAX_SELECTED_SCREENSHOTS = 3;

// --- UI Elements ---
const { panel, panelLayer, reopenButton } = createPanel();
const input = document.getElementById("bgt-input");
const selectedElementBlock = document.getElementById("bgt-selected-element");
const selectedScreenshotsBlock = document.getElementById("bgt-selected-screenshots");
const chatBlock = document.getElementById("bgt-chat");
const statusBlock = document.getElementById("bgt-status");
const generateTestsCheckbox = document.getElementById("bgt-generate-tests");
const testModeHint = document.getElementById("bgt-test-mode-hint");
const addTestButton = document.getElementById("bgt-add-test");
const sendButton = document.getElementById("bgt-send");

// --- Functions ---

function setStatus(text, color = "#6b7280") {
  statusBlock.textContent = `Status: ${text}`;
  statusBlock.style.color = color;
}

function addMessage(role, text, options = {}) {
    return addMessageToChat(role, text, chatBlock, options);
}

function setRequestUiLocked(locked) {
    setUiLock(locked, sendButton, addTestButton, input);
}

function addTestCaseCard(testCase, index) {
    return addCard(testCase, index, chatBlock);
}


function pushHistory(role, content) {
  conversationHistory = [...conversationHistory, {
    role,
    content: String(content || ""),
  }].slice(-MAX_HISTORY_ITEMS);
  saveConversationHistory(conversationHistory);
}

async function loadTestmoFolderId() {
  try {
    const response = await fetch("http://localhost:3000/api/config");
    const result = await response.json();
    const folderId = Number(result?.testmoFolderId || 0);

    if (Number.isInteger(folderId) && folderId > 0) {
      testmoFolderId = folderId;
      console.log("Loaded Testmo folder id from server:", testmoFolderId);
    }
  } catch (error) {
    console.warn("Failed to load Testmo folder id from server:", error);
  }
}

function setTestModeHint(active, source = "manual") {
  if (!testModeHint) return;
  if (!active) {
    testModeHint.textContent = "Mode: chat";
    testModeHint.style.color = "#6b7280";
    return;
  }
  testModeHint.textContent = source === "auto" ? "Mode: test cases (auto-detected)" : "Mode: test cases";
  testModeHint.style.color = "#15803d";
}

function renderSelectedElementsSummary() {
  if (!selectedElementBlock) return;
  if (!selectedElements.length) {
    selectedElementBlock.textContent = "Елементи не вибрано";
    return;
  }
  const latest = selectedElements[selectedElements.length - 1];
  const summary = selectedElements
    .slice(-5)
    .map((item, index) => `${selectedElements.length - 4 + index > 0 ? `${selectedElements.length - 4 + index}. ` : ""}${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
    .join("
");
  selectedElementBlock.textContent = `Задача:
${summary}

Останній: ${latest.tag}: ${latest.text || latest.ariaLabel || latest.placeholder || "Елемент вибрано"}`;
}

function renderSelectedScreenshotsSummary() {
  if (!selectedScreenshotsBlock) return;
  if (!selectedScreenshots.length) {
    selectedScreenshotsBlock.textContent = "Фото ще не вибрано";
    return;
  }
  const selectedCount = selectedScreenshots.filter((item) => item.selected !== false).length;
  selectedScreenshotsBlock.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">Фото для відправки (${selectedCount}/${MAX_SELECTED_SCREENSHOTS})</div>
    <div style="margin-bottom:6px; color:#6b7280;">Можна відмітити до ${MAX_SELECTED_SCREENSHOTS}. Кліків і скріншотів може бути скільки завгодно.</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${selectedScreenshots
        .map((item, index) => {
          const previewLabel = escapeHtml(item.label || `Фото ${index + 1}`);
          const checked = item.selected !== false ? "checked" : "";
          const disabled = item.selected !== false || selectedCount < MAX_SELECTED_SCREENSHOTS ? "" : "disabled";
          return `
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
              <input type="checkbox" data-screenshot-id="${escapeHtml(item.id)}" ${checked} ${disabled} style="margin-top:2px;" />
              <span style="display:flex; flex-direction:column; gap:4px; flex:1;">
                <span>${previewLabel}</span>
                <img src="${item.dataUrl}" alt="${previewLabel}" style="max-width:120px; max-height:70px; border-radius:4px; border:1px solid #d1d5db; object-fit:cover;" />
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
  selectedScreenshotsBlock.querySelectorAll("input[type='checkbox'][data-screenshot-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const screenshotId = target?.getAttribute("data-screenshot-id");
      if (!screenshotId) return;
      if (!target.checked) {
        selectedScreenshots = selectedScreenshots.map((item) => (item.id === screenshotId ? { ...item, selected: false } : item));
        renderSelectedScreenshotsSummary();
        return;
      }
      const currentlySelected = selectedScreenshots.filter((item) => item.selected !== false).length;
      if (currentlySelected >= MAX_SELECTED_SCREENSHOTS) {
        target.checked = false;
        addMessage("assistant", `Можна вибрати лише ${MAX_SELECTED_SCREENSHOTS} фото для відправки.`);
        setStatus(`обрано максимум ${MAX_SELECTED_SCREENSHOTS} фото`, "#b45309");
        return;
      }
      selectedScreenshots = selectedScreenshots.map((item) => (item.id === screenshotId ? { ...item, selected: Boolean(target.checked) } : item));
      renderSelectedScreenshotsSummary();
    });
  });
}

function renderTestCases(testCases) {
  renderedTestCases = Array.isArray(testCases) ? testCases : [];
  const existingCards = chatBlock.querySelectorAll("[data-test-case-card='true']");
  existingCards.forEach((node) => node.remove());
  renderedTestCases.forEach((testCase, index) => addTestCaseCard(testCase, index));
}

function updateAddTestButtonLabel() {
  const displayNumber = Math.min(nextInlineTestNumber, MAX_TESTS);
  addTestButton.textContent = `Add Test Case #${displayNumber}`;
}

function insertTestLabel() {
  if (nextInlineTestNumber > MAX_TESTS) {
    setStatus("maximum 10 tests reached", "#b45309");
    addMessage("assistant", "Maximum 10 tests per prompt reached.");
    return;
  }
  const label = `Test ${nextInlineTestNumber}: `;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const needsNewLine = before.length > 0 && !before.endsWith("
");
  const insertion = `${needsNewLine ? "
" : ""}${label}`;
  input.value = `${before}${insertion}${after}`;
  const caretPosition = before.length + insertion.length;
  input.selectionStart = caretPosition;
  input.selectionEnd = caretPosition;
  addMessage("assistant", `Added ${label.trim()} marker.`);
  setStatus(`${label.trim()} inserted`, "#15803d");
  nextInlineTestNumber += 1;
  updateAddTestButtonLabel();
  input.focus();
}

function addScreenshotMessage(screenshotDataUrl) {
  const message = document.createElement("div");
  message.style.marginBottom = "8px";
  message.style.padding = "6px";
  message.style.borderRadius = "6px";
  message.style.background = "#f3f4f6";
  const thumbnail = document.createElement("img");
  thumbnail.src = screenshotDataUrl;
  thumbnail.style.maxWidth = "120px";
  thumbnail.style.maxHeight = "120px";
  thumbnail.style.borderRadius = "4px";
  thumbnail.style.cursor = "pointer";
  thumbnail.style.border = "1px solid #d1d5db";
  thumbnail.title = "Click to view full screenshot";
  thumbnail.addEventListener("click", () => {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.8)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "2147483648";
    const fullImg = document.createElement("img");
    fullImg.src = screenshotDataUrl;
    fullImg.style.maxWidth = "90vw";
    fullImg.style.maxHeight = "90vh";
    fullImg.style.borderRadius = "8px";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.right = "20px";
    closeBtn.style.background = "white";
    closeBtn.style.border = "none";
    closeBtn.style.width = "40px";
    closeBtn.style.height = "40px";
    closeBtn.style.borderRadius = "50%";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "24px";
    closeBtn.addEventListener("click", () => modal.remove());
    modal.appendChild(fullImg);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  });
  message.appendChild(thumbnail);
  chatBlock.appendChild(message);
  chatBlock.scrollTop = chatBlock.scrollHeight;
}

function captureScreenshot() {
  return new Promise((resolve) => {
    sendRuntimeMessage({ type: "CAPTURE_SCREENSHOT" }).then(response => {
      console.log("Screenshot response:", response);
      resolve(response?.screenshot || null);
    }).catch(error => {
      console.error("Screenshot runtime error:", error.message);
      resolve(null);
    });
  });
}

async function sendPrompt() {
  if (isRequestInFlight) {
    addMessage("assistant", "Previous request is still running. Please wait a few seconds.");
    return;
  }
  const userPrompt = input.value.trim();
  if (!userPrompt) {
    addMessage("assistant", "Write prompt first.");
    return;
  }
  const displayPrompt = userPrompt;
  const forcedTestGeneration = Boolean(generateTestsCheckbox?.checked);
  const shouldGenerateTests = forcedTestGeneration || isLikelyTestRequest(userPrompt);
  setTestModeHint(shouldGenerateTests, forcedTestGeneration ? "manual" : "auto");
  setRequestUiLocked(true);
  isRequestInFlight = true;
  setStatus("sending prompt...", "#3b82f6");
  addMessage("user", displayPrompt);
  pushHistory("user", userPrompt);
  const profile = learnFromPrompt(userPrompt, getPreferenceProfile, savePreferenceProfile);
  const activeScreenshots = selectedScreenshots.filter(s => s.selected !== false);
  const compressedScreenshots = await normalizeScreenshotList(
    await Promise.all(activeScreenshots.map(s => compressScreenshotDataUrl(s.dataUrl))),
    MAX_SELECTED_SCREENSHOTS
  );
  if (compressedScreenshots.length > 0) {
    addMessage("assistant", `Sending ${compressedScreenshots.length} screenshot(s) with prompt...`);
  }
  try {
    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userPrompt,
        conversation: conversationHistory,
        selection: normalizeSelectionList(selectedElements),
        screenshots: compressedScreenshots,
        options: {
          generateTestCases: shouldGenerateTests,
          profile: profile,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }
    if (result.clarification) {
      addMessage("assistant", result.clarification);
      pushHistory("assistant", result.clarification);
      setStatus("clarification requested", "#f59e0b");
    } else if (result.testCases) {
      addMessage("assistant", `Generated ${result.testCases.length} test case(s). Review and approve below.`);
      renderTestCases(result.testCases);
      setStatus(`generated ${result.testCases.length} tests`, "#15803d");
    } else {
      addMessage("assistant", result.text);
      pushHistory("assistant", result.text);
      setStatus("response received", "#15803d");
    }
  } catch (error) {
    console.error("Request failed:", error);
    addMessage("assistant", `Request failed: ${error.message}`);
    setStatus("error", "#b91c1c");
  } finally {
    setRequestUiLocked(false);
    isRequestInFlight = false;
    selectedElements = [];
    selectedScreenshots = [];
    renderSelectedElementsSummary();
    renderSelectedScreenshotsSummary();
    input.value = "";
    nextInlineTestNumber = 1;
    updateAddTestButtonLabel();
    input.focus();
  }
}

// --- Event Listeners ---

document.addEventListener("mouseover", (event) => {
  if (panel.contains(event.target)) return;
  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }
  highlightedElement = event.target;
  highlightedElement.style.outline = "3px solid red";
});

document.addEventListener("click", async (event) => {
  if (panel.contains(event.target) || !event.shiftKey) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const element = event.target;
  const selectedElementData = normalizeSelectionItem({
    tag: element.tagName.toLowerCase(),
    text: element.innerText || element.textContent || "",
    ariaLabel: element.getAttribute("aria-label"),
    placeholder: element.getAttribute("placeholder"),
    id: element.id,
    className: element.className,
    outerHTML: element.outerHTML,
    url: window.location.href,
    pageTitle: document.title,
  });
  selectedElements = [...selectedElements, selectedElementData];
  let selectedScreenshot = await captureScreenshot();
  selectedScreenshot = await compressScreenshotDataUrl(selectedScreenshot);
  if (selectedScreenshot) {
    const screenshotLabel = `Фото ${selectedScreenshots.length + 1}: ${selectedElementData.tag}${selectedElementData.text || selectedElementData.ariaLabel || selectedElementData.placeholder ? ` - ${selectedElementData.text || selectedElementData.ariaLabel || selectedElementData.placeholder}` : ""}`;
    const selectedCount = selectedScreenshots.filter((item) => item.selected !== false).length;
    selectedScreenshots = [
      ...selectedScreenshots,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dataUrl: selectedScreenshot,
        label: screenshotLabel,
        selected: selectedCount < MAX_SELECTED_SCREENSHOTS,
      },
    ];
  }
  renderSelectedElementsSummary();
  renderSelectedScreenshotsSummary();
  const selectionLines = selectedElements
    .map((item) => `- ${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
    .join("
");
  input.value = `Tasks:
${selectionLines}

`;
  input.selectionStart = input.value.length;
  input.selectionEnd = input.value.length;
  input.focus();
  console.log("Selected element saved locally:", selectedElementData);
  console.log("Selection count saved locally:", selectedElements.length);
  console.log("Screenshot saved locally:", Boolean(selectedScreenshot));
}, true);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendButton.click();
  }
});

input.addEventListener("input", () => {
  const text = input.value;
  const autoDetected = isLikelyTestRequest(text);
  if (!generateTestsCheckbox.checked) {
    setTestModeHint(autoDetected, "auto");
  }
});

generateTestsCheckbox.addEventListener("change", () => {
  const isChecked = generateTestsCheckbox.checked;
  setTestModeHint(isChecked, "manual");
});

addTestButton.addEventListener("click", insertTestLabel);
sendButton.addEventListener("click", sendPrompt);
setupPanelEvents(panel, panelLayer, reopenButton, input);
input.addEventListener("focus", () => setStatus("input focused", "#15803d"), true);

// --- Initialization ---
conversationHistory = loadConversationHistory();
void loadTestmoFolderId();
updateAddTestButtonLabel();
setTestModeHint(false);


console.log("Browser GPT Testmo Helper loaded");

let highlightedElement = null;
let selectedElementData = null;
let selectedElements = [];
let selectedScreenshot = null;
let selectedScreenshots = [];
let conversationHistory = [];
let nextInlineTestNumber = 1;
let isRequestInFlight = false;
let renderedTestCases = [];

const MAX_TESTS = 10;

function pushHistory(role, content) {
  conversationHistory = [...conversationHistory, {
    role,
    content: String(content || ""),
  }].slice(-MAX_HISTORY_ITEMS);

  saveConversationHistory(conversationHistory);
}

conversationHistory = loadConversationHistory();

const { panel, panelLayer, reopenButton } = createPanel();


const input = document.getElementById("bgt-input");
setupPanelEvents(panel, panelLayer, reopenButton, input);

const panelHeader = document.getElementById("bgt-header");

function renderSelectedElementsSummary() {
  if (!selectedElementBlock) {
    return;
  }

  if (!selectedElements.length) {
    selectedElementBlock.textContent = "Елементи не вибрано";
    return;
  }

  const latest = selectedElements[selectedElements.length - 1];
  const summary = selectedElements
    .slice(-5)
    .map((item, index) => `${selectedElements.length - 4 + index > 0 ? `${selectedElements.length - 4 + index}. ` : ""}${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
    .join("\n");

  selectedElementBlock.textContent = `Задача:\n${summary}\n\nОстанній: ${latest.tag}: ${latest.text || latest.ariaLabel || latest.placeholder || "Елемент вибрано"}`;
}

function renderSelectedScreenshotsSummary() {
  if (!selectedScreenshotsBlock) {
    return;
  }

  if (!selectedScreenshots.length) {
    selectedScreenshotsBlock.textContent = "Фото ще не вибрано";
    return;
  }

  const selectedCount = selectedScreenshots.filter((item) => item.selected !== false).length;
  selectedScreenshotsBlock.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">Фото для відправки (${selectedCount}/${MAX_SELECTED_SCREENSHOTS})</div>
    <div style="margin-bottom:6px; color:#6b7280;">Можна відмітити до ${MAX_SELECTED_SCREENSHOTS}. Кліків і скріншотів може бути скільки завгодно.</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${selectedScreenshots
        .map((item, index) => {
          const previewLabel = escapeHtml(item.label || `Фото ${index + 1}`);
          const checked = item.selected !== false ? "checked" : "";
          const disabled = item.selected !== false || selectedCount < MAX_SELECTED_SCREENSHOTS ? "" : "disabled";
          return `
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
              <input type="checkbox" data-screenshot-id="${escapeHtml(item.id)}" ${checked} ${disabled} style="margin-top:2px;" />
              <span style="display:flex; flex-direction:column; gap:4px; flex:1;">
                <span>${previewLabel}</span>
                <img src="${item.dataUrl}" alt="${previewLabel}" style="max-width:120px; max-height:70px; border-radius:4px; border:1px solid #d1d5db; object-fit:cover;" />
              </span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;

  selectedScreenshotsBlock.querySelectorAll("input[type='checkbox'][data-screenshot-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.currentTarget;
      const screenshotId = target?.getAttribute("data-screenshot-id");
      if (!screenshotId) {
        return;
      }

      if (!target.checked) {
        selectedScreenshots = selectedScreenshots.map((item) => (
          item.id === screenshotId
            ? { ...item, selected: false }
            : item
        ));
        renderSelectedScreenshotsSummary();
        return;
      }

      const currentlySelected = selectedScreenshots.filter((item) => item.selected !== false).length;
      if (currentlySelected >= MAX_SELECTED_SCREENSHOTS) {
        target.checked = false;
        addMessage("assistant", `Можна вибрати лише ${MAX_SELECTED_SCREENSHOTS} фото для відправки.`);
        setStatus(`обрано максимум ${MAX_SELECTED_SCREENSHOTS} фото`, "#b45309");
        return;
      }

      selectedScreenshots = selectedScreenshots.map((item) => (
        item.id === screenshotId
          ? { ...item, selected: Boolean(target.checked) }
          : item
      ));

      renderSelectedScreenshotsSummary();
    });
  });
}

function setRequestUiLocked(locked) {
  setRequestUiLocked(locked, sendButton, addTestButton, input);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function priorityToCustomPriority(priority) {
  if (priority === "High") {
    return 3;
  }

  if (priority === "Low") {
    return 1;
  }

  return 2;
}

function buildPreconditionsHtml(preconditionsEn) {
  const lines = (preconditionsEn || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<div><strong>Preconditions:</strong>${lines}</div>`;
}

function normalizeExpectedLine(line) {
  return String(line || "")
    .replace(/^\s*\d+(?:\.\d+)?[\)\.]?\s*/u, "")
    .trim();
}

function formatExpectedLines(lines, stepIndex) {
  return (lines || []).map((line, expectedIndex) => {
    const normalized = normalizeExpectedLine(line);
    return `${stepIndex + 1}.${expectedIndex + 1} ${normalized}`.trim();
  });
}

function buildExpectedHtml(expectedEn, stepIndex) {
  const numbered = formatExpectedLines(expectedEn, stepIndex);
  return `<p>${numbered.map((line) => escapeHtml(line)).join("<br />")}</p>`;
}

function splitTextLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitExpectedText(value) {
  return splitTextLines(value).map((line) => normalizeExpectedLine(line));
}

function normalizeStringValue(value) {
  return String(value || "").trim();
}

async function compressScreenshotDataUrl(dataUrl, { maxWidth = 960, maxHeight = 960, quality = 0.35 } = {}) {
  if (!dataUrl) {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const originalWidth = image.width || 1;
        const originalHeight = image.height || 1;
        const widthRatio = maxWidth / originalWidth;
        const heightRatio = maxHeight / originalHeight;
        const ratio = Math.min(1, widthRatio, heightRatio);
        const targetWidth = Math.max(1, Math.round(originalWidth * ratio));
        const targetHeight = Math.max(1, Math.round(originalHeight * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed || dataUrl);
      } catch (error) {
        console.warn("Failed to compress screenshot:", error);
        resolve(dataUrl);
      }
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function normalizeScreenshotList(items, limit = 1) {
  const screenshots = Array.isArray(items) ? items : [];
  const normalized = [];

  for (const item of screenshots.slice(-limit)) {
    const source = typeof item === "string" ? item : item?.dataUrl;
    if (source) {
      normalized.push(source);
    }
  }

  return normalized;
}

function normalizeSelectionItem(item) {
  return {
    tag: normalizeStringValue(item?.tag),
    text: normalizeStringValue(item?.text),
    ariaLabel: normalizeStringValue(item?.ariaLabel),
    placeholder: normalizeStringValue(item?.placeholder),
    id: normalizeStringValue(item?.id),
    className: Array.isArray(item?.className)
      ? item.className.map((value) => normalizeStringValue(value)).filter(Boolean)
      : normalizeStringValue(item?.className),
    outerHTML: normalizeStringValue(item?.outerHTML),
    url: normalizeStringValue(item?.url),
    pageTitle: normalizeStringValue(item?.pageTitle),
  };
}

function normalizeSelectionList(items) {
  return (Array.isArray(items) ? items : []).map((item) => normalizeSelectionItem(item));
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || {});
    });
  });
}

function formatSequence(sequence) {
  return String(sequence).padStart(4, "0");
}

async function getNextDraftSequence() {
  const response = await sendRuntimeMessage({ type: "GET_NEXT_DRAFT_SEQUENCE" });

  if (response.error) {
    throw new Error(response.error);
  }

  return Number(response.sequence || 0);
}

async function saveDraftJsonFile(fileName, draftData) {
  const response = await sendRuntimeMessage({
    type: "SAVE_DRAFT_JSON",
    fileName,
    jsonContent: JSON.stringify(draftData, null, 2),
  });

  if (response.error) {
    throw new Error(response.error);
  }

  return response;
}

function buildTestmoDraft(testCase, sequence) {
  return {
    generated_case_id: sequence,
    case: {
      // The server enforces folder_id from TESTMO_FOLDER_ID in .env.
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

function addTestCaseCard(testCase, index) {
  return addTestCaseCard(testCase, index, chatBlock);
}

function renderTestCases(testCases) {
  renderedTestCases = Array.isArray(testCases) ? testCases : [];

  const existingCards = chatBlock.querySelectorAll("[data-test-case-card='true']");
  existingCards.forEach((node) => node.remove());

  renderedTestCases.forEach((testCase, index) => addTestCaseCard(testCase, index));
}

function setStatus(text, color = "#6b7280") {
  statusBlock.textContent = `Status: ${text}`;
  statusBlock.style.color = color;
}

function updateAddTestButtonLabel() {
  const displayNumber = Math.min(nextInlineTestNumber, MAX_TESTS);
  addTestButton.textContent = `Add Test Case #${displayNumber}`;
}

function insertTestLabel() {
  if (nextInlineTestNumber > MAX_TESTS) {
    setStatus("maximum 10 tests reached", "#b45309");
    addMessage("assistant", "Maximum 10 tests per prompt reached.");
    return;
  }

  const label = `Test ${nextInlineTestNumber}: `;
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

  nextInlineTestNumber += 1;
  updateAddTestButtonLabel();
  input.focus();
}

function addScreenshotMessage(screenshotDataUrl) {
  const message = document.createElement("div");
  message.style.marginBottom = "8px";
  message.style.padding = "6px";
  message.style.borderRadius = "6px";
  message.style.background = "#f3f4f6";

  const thumbnail = document.createElement("img");
  thumbnail.src = screenshotDataUrl;
  thumbnail.style.maxWidth = "120px";
  thumbnail.style.maxHeight = "120px";
  thumbnail.style.borderRadius = "4px";
  thumbnail.style.cursor = "pointer";
  thumbnail.style.border = "1px solid #d1d5db";
  thumbnail.title = "Click to view full screenshot";

  thumbnail.addEventListener("click", () => {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.8)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "2147483648";

    const fullImg = document.createElement("img");
    fullImg.src = screenshotDataUrl;
    fullImg.style.maxWidth = "90vw";
    fullImg.style.maxHeight = "90vh";
    fullImg.style.borderRadius = "8px";

    const closeButton = document.getElementById("bgt-close");
    closeButton.textContent = "✕";
    closeButton.style.position = "absolute";
    closeButton.style.top = "20px";
    closeButton.style.right = "20px";
    closeButton.style.background = "white";
    closeButton.style.border = "none";
    closeButton.style.width = "40px";
    closeButton.style.height = "40px";
    closeButton.style.borderRadius = "50%";
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "24px";
    closeButton.addEventListener("click", () => modal.remove());

    modal.appendChild(fullImg);
    modal.appendChild(closeButton);
    document.body.appendChild(modal);
  });

  message.appendChild(thumbnail);
  chatBlock.appendChild(message);
  chatBlock.scrollTop = chatBlock.scrollHeight;
}

function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      (response) => {
        console.log("Screenshot response:", response);

        if (chrome.runtime.lastError) {
          console.error("Screenshot runtime error:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }

        resolve(response?.screenshot || null);
      }
    );
  });
}

document.addEventListener("mouseover", (event) => {
  if (panel.contains(event.target)) {
    return;
  }

  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }

  highlightedElement = event.target;
  highlightedElement.style.outline = "3px solid red";
});

document.addEventListener(
  "click",
  async (event) => {
    if (panel.contains(event.target)) {
      return;
    }

    if (!event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = event.target;

    selectedElementData = normalizeSelectionItem({
      tag: element.tagName.toLowerCase(),
      text: element.innerText || element.textContent || "",
      ariaLabel: element.getAttribute("aria-label"),
      placeholder: element.getAttribute("placeholder"),
      id: element.id,
      className: element.className,
      outerHTML: element.outerHTML,
      url: window.location.href,
      pageTitle: document.title,
    });

    selectedElements = [...selectedElements, selectedElementData];

    selectedScreenshot = await captureScreenshot();
    selectedScreenshot = await compressScreenshotDataUrl(selectedScreenshot);
    if (selectedScreenshot) {
      const screenshotLabel = `Фото ${selectedScreenshots.length + 1}: ${selectedElementData.tag}${selectedElementData.text || selectedElementData.ariaLabel || selectedElementData.placeholder ? ` - ${selectedElementData.text || selectedElementData.ariaLabel || selectedElementData.placeholder}` : ""}`;
      const selectedCount = selectedScreenshots.filter((item) => item.selected !== false).length;
      selectedScreenshots = [
        ...selectedScreenshots,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          dataUrl: selectedScreenshot,
          label: screenshotLabel,
          selected: selectedCount < MAX_SELECTED_SCREENSHOTS,
        },
      ];
    }

    renderSelectedElementsSummary();
    renderSelectedScreenshotsSummary();

    const selectionLines = selectedElements
      .map((item) => `- ${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
      .join("\n");

    input.value = `Tasks:\n${selectionLines}\n\n`;
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;

    input.focus();

    console.log("Selected element saved locally:", selectedElementData);
    console.log("Selection count saved locally:", selectedElements.length);
    console.log("Screenshot saved locally:", Boolean(selectedScreenshot));
  },
  true
);

async function sendPrompt() {
  if (isRequestInFlight) {
    addMessage("assistant", "Previous request is still running. Please wait a few seconds.");
    return;
  }

  const userPrompt = input.value.trim();

  if (!userPrompt) {
    addMessage("assistant", "Write prompt first.");
    return;
  }

  // More flexible regex to detect test markers: "Test 1", "Test 1:", "Тест 1", etc.
  const isTestPrompt = /(?:^|\n).*?(test|тест)\s*\d+/iu.test(userPrompt);
  const displayPrompt = userPrompt;

  console.log("[DEBUG] Prompt first 100 chars:", userPrompt.substring(0, 100));
  console.log("[DEBUG] Is test prompt:", isTestPrompt);
  console.log("[DEBUG] Has selected elements:", selectedElements.length);

  const forcedTestGeneration = Boolean(generateTestsCheckbox?.checked);
  const shouldGenerateTests = forcedTestGeneration;

  setTestModeHint(shouldGenerateTests, "manual");

  if (shouldGenerateTests && !selectedElements.length) {
    addMessage("assistant", "Select an element first with Shift + Click before generating test cases.");
    return;
  }

  addMessage("user", displayPrompt);
  pushHistory("user", userPrompt);
  const preferenceProfile = learnFromPrompt(userPrompt);
  input.value = "";

  isRequestInFlight = true;
  setRequestUiLocked(true);

  const primarySelection = selectedElements[selectedElements.length - 1] || selectedElementData;
  const normalizedSelectedElements = normalizeSelectionList(selectedElements);
  const selectedScreenshotPayloads = selectedScreenshots
    .filter((item) => item.selected !== false)
    .map((item) => item.dataUrl);
  const normalizedSelectedScreenshots = await normalizeScreenshotList(selectedScreenshotPayloads, selectedScreenshotPayloads.length || 1);
  const pageUrl = primarySelection?.url || window.location.href;
  const pageTitle = primarySelection?.pageTitle || document.title;
  const selectedText = primarySelection?.text || "";
  const elementLabel = primarySelection?.text || primarySelection?.ariaLabel || primarySelection?.placeholder || "";
  const ariaLabel = primarySelection?.ariaLabel || "";
  const placeholder = primarySelection?.placeholder || "";
  const elementTag = primarySelection?.tag || "";

  const payload = shouldGenerateTests
    ? {
      html: primarySelection?.outerHTML || "",
      url: pageUrl,
      pageTitle,
      selectedText,
      elementLabel,
      ariaLabel,
      placeholder,
      elementTag,
      selectedElements: normalizedSelectedElements,
      images: normalizedSelectedScreenshots.slice(0, MAX_SELECTED_SCREENSHOTS),
      userPrompt,
      conversationHistory,
      preferenceProfile,
    }
    : {
      userPrompt,
      html: primarySelection?.outerHTML || "",
      url: pageUrl,
      pageTitle,
      selectedText,
      elementLabel,
      ariaLabel,
      placeholder,
      elementTag,
      selectedElements: normalizedSelectedElements,
      images: normalizedSelectedScreenshots.slice(0, MAX_SELECTED_SCREENSHOTS),
      conversationHistory,
      preferenceProfile,
    };

  const pendingMessage = addMessage("assistant", shouldGenerateTests ? "Generating test case(s)..." : "Thinking...");
  console.log("Payload ready:", payload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes
  
  let elapsedSeconds = 0;
  const updateInterval = setInterval(() => {
    elapsedSeconds++;
    const msg = elapsedSeconds > 15 ? `generating (${elapsedSeconds}s) - waiting for LLM...` : `generating (${elapsedSeconds}s)`;
    setStatus(msg, "#b45309");
  }, 1000);

  try {
    setStatus("sending request", "#b45309");

    const endpoint = shouldGenerateTests
      ? "http://localhost:3000/api/generate-testcases"
      : "http://localhost:3000/api/chat";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    setStatus("waiting for response", "#b45309");

    const result = await response.json();

    if (!response.ok) {
      const serverError = result?.message || result?.error || `HTTP ${response.status}`;
      throw new Error(serverError);
    }

    console.log("Server response:", result);
    setStatus(shouldGenerateTests ? "test case generated" : "assistant replied", "#15803d");

    if (shouldGenerateTests) {
      if (result.reply) {
        pendingMessage.textContent = result.reply;
        pushHistory("assistant", result.reply);
      } else if (result.testCases && Array.isArray(result.testCases)) {
        pendingMessage.textContent = `Generated ${result.testCases.length} test case(s) (took ${elapsedSeconds}s).`;
        pushHistory("assistant", `Generated ${result.testCases.length} test case(s).`);
        renderTestCases(result.testCases);
      } else {
        pendingMessage.textContent = `Server response:\n${JSON.stringify(result, null, 2)}`;
      }

      if (result?.debug) {
        console.log("[DEBUG] Screenshot delivery result:", result.debug);
      }

      nextInlineTestNumber = 1;
      updateAddTestButtonLabel();

      selectedScreenshots = [];
      renderSelectedScreenshotsSummary();
      console.log("Screenshots cleared after successful response.");

    } else {
      const reply = result?.reply || "No response text.";
      pendingMessage.textContent = reply;
      pushHistory("assistant", reply);
    }
  } catch (error) {
    console.error("Failed to send payload:", error);
    
    let errorMsg = error.message;
    if (error.name === "AbortError") {
      errorMsg = "Request timeout (3 minutes exceeded) - LLM is taking too long or API is overloaded";
    }
    
    setStatus(shouldGenerateTests ? "failed to generate test" : "chat failed", "#b91c1c");
    pendingMessage.textContent = `❌ ${shouldGenerateTests ? "Failed to generate test case" : "Failed to get chat reply"}: ${errorMsg}`;
    pendingMessage.style.background = "#fee2e2";

    if (shouldGenerateTests) {
      nextInlineTestNumber = 1;
      updateAddTestButtonLabel();
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(updateInterval);

    isRequestInFlight = false;
    setRequestUiLocked(false);
  }
}

sendButton.addEventListener("click", sendPrompt);

addTestButton.addEventListener("click", insertTestLabel);
updateAddTestButtonLabel();

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendPrompt();
  }
});

async function loadTestmoFolderId() {
  try {
    const response = await fetch("http://localhost:3000/api/config");
    const result = await response.json();
    const folderId = Number(result?.testmoFolderId || 0);

    if (Number.isInteger(folderId) && folderId > 0) {
      testmoFolderId = folderId;
      console.log("Loaded Testmo folder id from server:", testmoFolderId);
    }
  } catch (error) {
    console.warn("Failed to load Testmo folder id from server:", error);
  }
}

void loadTestmoFolderId();

function setTestModeHint(active, source = "manual") {
  if (!testModeHint) {
    return;
  }

  if (!active) {
    testModeHint.textContent = "Mode: chat";
    testModeHint.style.color = "#6b7280";
    return;
  }

  testModeHint.textContent = source === "auto" ? "Mode: test cases (auto-detected)" : "Mode: test cases";
  testModeHint.style.color = "#15803d";
}

input.addEventListener(
  "focus",
  () => {
    setStatus("input focused", "#15803d");
  },
  true,
);