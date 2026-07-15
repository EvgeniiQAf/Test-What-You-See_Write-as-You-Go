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

const HISTORY_STORAGE_KEY = "bgt-conversation-history";
const PROFILE_STORAGE_KEY = "bgt-preference-profile";
const MAX_HISTORY_ITEMS = 20;
const MAX_TESTS = 10;

const defaultPreferenceProfile = {
  preferredLanguage: "ua-en",
  prefersVerifyPrefix: true,
  prefersScreenContextPreconditions: true,
  expectedNumberingStyle: "step-subpoint",
  maxCasesPreference: 10,
  notes: ["Use the bilingual UA/EN house style with matching meaning and exact UI labels."],
};

function loadConversationHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load conversation history:", error);
    return [];
  }
}

function saveConversationHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY_ITEMS)));
  } catch (error) {
    console.warn("Failed to save conversation history:", error);
  }
}

function pushHistory(role, content) {
  conversationHistory = [...conversationHistory, {
    role,
    content: String(content || ""),
  }].slice(-MAX_HISTORY_ITEMS);

  saveConversationHistory(conversationHistory);
}

function getPreferenceProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;

    if (!parsed || typeof parsed !== "object") {
      return { ...defaultPreferenceProfile };
    }

    return {
      ...defaultPreferenceProfile,
      ...parsed,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [...defaultPreferenceProfile.notes],
    };
  } catch (error) {
    console.warn("Failed to load preference profile:", error);
    return { ...defaultPreferenceProfile };
  }
}

function savePreferenceProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Failed to save preference profile:", error);
  }
}

conversationHistory = loadConversationHistory();

const panelLayer = document.createElement("div");
const panel = document.createElement("div");

panel.innerHTML = `
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

panelLayer.style.position = "fixed";
panelLayer.style.inset = "0";
panelLayer.style.zIndex = "2147483647";
panelLayer.style.pointerEvents = "none";

panel.style.position = "absolute";
panel.style.top = "20px";
panel.style.left = "20px";
panel.style.width = "480px";
panel.style.maxWidth = "90vw";
panel.style.height = "520px";
panel.style.background = "white";
panel.style.color = "#111827";
panel.style.border = "1px solid #d1d5db";
panel.style.borderRadius = "10px";
panel.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
panel.style.padding = "12px";
panel.style.fontFamily = "Arial, sans-serif";
panel.style.resize = "both";
panel.style.overflow = "auto";
panel.style.minWidth = "380px";
panel.style.minHeight = "280px";
panel.style.display = "flex";
panel.style.flexDirection = "column";
panel.style.pointerEvents = "auto";

panelLayer.appendChild(panel);
document.documentElement.appendChild(panelLayer);

const reopenButton = document.createElement("button");
reopenButton.id = "bgt-reopen";
reopenButton.textContent = "Open Helper";
reopenButton.style.position = "fixed";
reopenButton.style.top = "20px";
reopenButton.style.left = "20px";
reopenButton.style.zIndex = "2147483647";
reopenButton.style.display = "none";
reopenButton.style.padding = "8px 10px";
reopenButton.style.border = "1px solid #d1d5db";
reopenButton.style.borderRadius = "8px";
reopenButton.style.background = "#ffffff";
reopenButton.style.color = "#111827";
reopenButton.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
reopenButton.style.cursor = "pointer";
reopenButton.style.pointerEvents = "auto";
reopenButton.style.fontSize = "12px";
document.documentElement.appendChild(reopenButton);

const panelHeader = document.getElementById("bgt-header");
const closeButton = document.getElementById("bgt-close");
const selectedElementBlock = document.getElementById("bgt-selected-element");
const selectedScreenshotsBlock = document.getElementById("bgt-selected-screenshots");
const chatBlock = document.getElementById("bgt-chat");
const statusBlock = document.getElementById("bgt-status");
const input = document.getElementById("bgt-input");
const generateTestsCheckbox = document.getElementById("bgt-generate-tests");
const testModeHint = document.getElementById("bgt-test-mode-hint");
const addTestButton = document.getElementById("bgt-add-test");
const sendButton = document.getElementById("bgt-send");

// Settings Panel DOM references
const toggleSettingsButton = document.getElementById("bgt-toggle-settings");
const settingsPanel = document.getElementById("bgt-settings-panel");
const settingFormat = document.getElementById("bgt-setting-format");
const settingLang = document.getElementById("bgt-setting-lang");
const settingLlm = document.getElementById("bgt-setting-llm");
const settingRules = document.getElementById("bgt-setting-rules");

let activeTms = "testmo";
let activeFolderId = null;
const MAX_SELECTED_SCREENSHOTS = 3;

function getSavedSettings() {
  return {
    format: localStorage.getItem("bgt-setting-format") || "steps",
    lang: localStorage.getItem("bgt-setting-lang") || "default",
    llm: localStorage.getItem("bgt-setting-llm") || "default",
    rules: localStorage.getItem("bgt-setting-rules") || "",
  };
}

function saveSettings(settings) {
  localStorage.setItem("bgt-setting-format", settings.format);
  localStorage.setItem("bgt-setting-lang", settings.lang);
  localStorage.setItem("bgt-setting-llm", settings.llm);
  localStorage.setItem("bgt-setting-rules", settings.rules);
}

function applySavedSettingsToUi() {
  const settings = getSavedSettings();
  if (settingFormat) settingFormat.value = settings.format;
  if (settingLang) settingLang.value = settings.lang;
  if (settingLlm) settingLlm.value = settings.llm;
  if (settingRules) settingRules.value = settings.rules;
}

async function loadTmsConfig() {
  try {
    const response = await fetch("http://localhost:3000/api/config");
    const result = await response.json();
    activeTms = result?.activeTms || "testmo";
    activeFolderId = activeTms === "testmo" ? result?.testmoFolderId : result?.testomatSuiteId;
    console.log(`Loaded TMS Config: activeTms=${activeTms}, activeFolderId=${activeFolderId}`);
  } catch (error) {
    console.warn("Failed to load TMS config from server:", error);
  }
}

void loadTmsConfig();
applySavedSettingsToUi();

// Add change listeners to save settings automatically
[settingFormat, settingLang, settingLlm].forEach(el => {
  el?.addEventListener("change", () => {
    saveSettings({
      format: settingFormat.value,
      lang: settingLang.value,
      llm: settingLlm.value,
      rules: settingRules.value,
    });
  });
});

settingRules?.addEventListener("input", () => {
  saveSettings({
    format: settingFormat.value,
    lang: settingLang.value,
    llm: settingLlm.value,
    rules: settingRules.value,
  });
});

// Toggle settings panel visibility
toggleSettingsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isHidden = settingsPanel.style.display === "none";
  settingsPanel.style.display = isHidden ? "flex" : "none";
  toggleSettingsButton.style.background = isHidden ? "#e5e7eb" : "#fff";
});

generateTestsCheckbox?.addEventListener("change", (event) => {
  setTestModeHint(event.target.checked, "manual");
});

settingFormat?.addEventListener("change", () => {
  setTestModeHint(generateTestsCheckbox.checked, "manual");
});

function learnFromPrompt(userPrompt) {
  const text = String(userPrompt || "").toLowerCase();
  const profile = getPreferenceProfile();
  const intentNotes = [];

  if (text.includes("ua") && text.includes("en")) {
    profile.preferredLanguage = "ua-en";
  } else if (text.includes("тільки ua") || text.includes("only ua")) {
    profile.preferredLanguage = "ua";
  } else if (text.includes("тільки en") || text.includes("only en")) {
    profile.preferredLanguage = "en";
  }

  if (text.includes("verify")) {
    profile.prefersVerifyPrefix = true;
  }

  if (text.includes("без лінк") || text.includes("no link") || text.includes("screen")) {
    profile.prefersScreenContextPreconditions = true;
  }

  if (text.includes("в нашому стилі") || text.includes("our style") || text.includes("same style")) {
    const styleNote = "Use the bilingual UA/EN house style with matching meaning and exact UI labels.";
    profile.notes = Array.from(new Set([...(profile.notes || []), styleNote]));
  }

  if (/(\b1\b|one|один|одна|одне)\s+(super|big|large|single|main|full|comprehensive|великий|велика|єдиний|головний|повний)/iu.test(text)) {
    intentNotes.push("Treat '1 big/super test' as one comprehensive case.");
  }

  if (/(split|divide|break\s+into|розбий|поділи|розділи)/iu.test(text) && /\b\d{1,2}\b/u.test(text)) {
    intentNotes.push("Treat split/divide requests literally by the requested number of cases.");
  }

  if (/(main\s+regression|основн(і|і\s+)?регресійн(і|і\s+)?|core\s+regression|main\s+tests?)/iu.test(text)) {
    intentNotes.push("Prefer the smallest solid regression set for main regression requests.");
  }

  if (intentNotes.length > 0) {
    profile.notes = Array.from(new Set([...(profile.notes || []), ...intentNotes]));
  }

  const countMatch = text.match(/(\d{1,2})\s*(test|тест)/u);
  if (countMatch?.[1]) {
    const parsed = Number(countMatch[1]);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 10) {
      profile.maxCasesPreference = parsed;
    }
  }

  savePreferenceProfile(profile);
  return profile;
}

function isLikelyTestRequest(text) {
  const normalized = String(text || "").toLowerCase();

  const explicitCountPattern = /\b\d{1,2}\s*(test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?|steps?|крок(и|ів)?|степ(и|ів)?)\b/u;
  if (explicitCountPattern.test(normalized)) {
    return true;
  }

  const testIntentPattern = /(зроби\s+.*тест|згенеруй\s+.*тест|test\s*plan|test\s*cases?|qa\s*test|тест(овий|ові)?\s+план|тести\s+для|tests?\s+for|for\s+this\s+block|for\s+this\s+element|на\s+твій\s+роздум|на\s+свій\s+розсуд)/iu;
  return testIntentPattern.test(normalized);
}

function setTestModeHint(active, source = "manual") {
  if (!testModeHint) {
    return;
  }

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

// Keep keyboard events inside the overlay so host pages cannot steal focus.
const isolatePanelKeyboardEvent = (event) => {
  event.stopPropagation();
};

panel.addEventListener("keydown", isolatePanelKeyboardEvent);
panel.addEventListener("keyup", isolatePanelKeyboardEvent);
panel.addEventListener("keypress", isolatePanelKeyboardEvent);

input.addEventListener("keydown", isolatePanelKeyboardEvent);
input.addEventListener("keyup", isolatePanelKeyboardEvent);
input.addEventListener("keypress", isolatePanelKeyboardEvent);

// Some sites keep modal focus using focusin traps.
// Stop those listeners for our panel controls so textarea can stay active.
document.addEventListener(
  "focusin",
  (event) => {
    if (panel.contains(event.target)) {
      event.stopImmediatePropagation();
    }
  },
  true,
);

input.addEventListener("mousedown", (event) => {
  event.stopPropagation();
});

input.addEventListener("click", (event) => {
  event.stopPropagation();
  input.focus();
});

input.addEventListener(
  "focus",
  () => {
    setStatus("input focused", "#15803d");
  },
  true,
);

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

const hidePanel = () => {
  panelLayer.style.display = "none";
  reopenButton.style.display = "block";
};

const showPanel = () => {
  panelLayer.style.display = "block";
  reopenButton.style.display = "none";
  input.focus();
};

closeButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hidePanel();
});

reopenButton.addEventListener("click", () => {
  showPanel();
});

panelHeader.addEventListener("mousedown", (event) => {
  isDragging = true;
  dragOffsetX = event.clientX - panel.offsetLeft;
  dragOffsetY = event.clientY - panel.offsetTop;
});

document.addEventListener("mousemove", (event) => {
  if (!isDragging) {
    return;
  }

  panel.style.left = `${event.clientX - dragOffsetX}px`;
  panel.style.top = `${event.clientY - dragOffsetY}px`;
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});

function addMessage(role, text, options = {}) {
  const shouldScroll = options.scroll !== false;
  const message = document.createElement("div");

  message.style.marginBottom = "8px";
  message.style.padding = "6px";
  message.style.borderRadius = "6px";
  message.style.whiteSpace = "pre-wrap";
  message.style.background = role === "user" ? "#dbeafe" : "#f3f4f6";
  message.style.userSelect = "text";
  message.style.webkitUserSelect = "text";
  message.style.cursor = "text";
  message.textContent = text;

  chatBlock.appendChild(message);
  if (shouldScroll) {
    chatBlock.scrollTop = chatBlock.scrollHeight;
  }

  return message;
}

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
              <input type="checkbox" data-screenshot-id="${escapeHtml(item.id)}" ${checked} ${disabled} style="all:revert; display: inline-block !important; opacity: 1 !important; visibility: visible !important; width: 14px !important; height: 14px !important; margin: 0 !important; margin-top:2px !important; cursor: pointer !important; -webkit-appearance: checkbox !important; appearance: checkbox !important;" />
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
  sendButton.disabled = locked;
  addTestButton.disabled = locked;
  input.disabled = locked;

  sendButton.style.opacity = locked ? "0.65" : "1";
  addTestButton.style.opacity = locked ? "0.65" : "1";
  input.style.opacity = locked ? "0.8" : "1";

  sendButton.style.cursor = locked ? "not-allowed" : "pointer";
  addTestButton.style.cursor = locked ? "not-allowed" : "pointer";
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
  const localTestCase = testCase;
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
    renderTestCases(renderedTestCases);
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
      if (!activeFolderId) {
        await loadTmsConfig();
      }

      if (!activeFolderId) {
        throw new Error(`Unable to load current ${activeTms} folder/suite identifier from server`);
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
      setStatus(`approved ${formattedSeq}, created in ${activeTms} (#${createdCaseId})`, "#15803d");
      addMessage("assistant", `Approved test #${index + 1}. Saved as ${fileName} and created in ${activeTms} case #${createdCaseId} (folder/suite ${usedFolderId}).`, { scroll: false });
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

    const closeButton = document.createElement("button");
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

  const preferredLlm = settingLlm?.value || "default";
  const format = settingFormat?.value || "steps";
  const language = settingLang?.value || "default";
  const customInstructions = settingRules?.value || "";

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
      preferredLlm,
      format,
      language,
      customInstructions,
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
      preferredLlm,
      format,
      language,
      customInstructions,
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