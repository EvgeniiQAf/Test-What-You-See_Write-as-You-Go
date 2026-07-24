console.log("Browser GPT Testmo Helper loaded (Hybrid Embedded + Floating Window Mode)");

// Initialize panel and add to DOM
const panelLayer = document.createElement("div");
const panel = document.createElement("div");

panelLayer.style.position = "fixed";
panelLayer.style.inset = "0";
panelLayer.style.zIndex = "2147483647";
panelLayer.style.pointerEvents = "none";

panel.style.position = "absolute";
panel.style.top = "20px";
panel.style.left = "20px";
panel.style.width = "520px";
panel.style.maxWidth = "90vw";
panel.style.height = "700px";
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

panel.innerHTML = mainPanelHtml;
setupPresetListeners();
panelLayer.appendChild(panel);
document.documentElement.appendChild(panelLayer);

// Reopen button element
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

// Cache DOM element lookups
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

const toggleSettingsButton = document.getElementById("bgt-toggle-settings");
const settingsPanel = document.getElementById("bgt-settings-panel");
const settingFormat = document.getElementById("bgt-setting-format");
const settingLang = document.getElementById("bgt-setting-lang");
const settingLlm = document.getElementById("bgt-setting-llm");
const settingRules = document.getElementById("bgt-setting-rules");

// Initialize state & panel listeners
window.conversationHistory = loadConversationHistory();
void loadTmsConfig();
initializeUiPanelListeners();

// Capture keyboard events inside panel to prevent host page shortcuts interception
const isolatePanelKeyboardEvent = (event) => {
  event.stopPropagation();
};
panel.addEventListener("keydown", isolatePanelKeyboardEvent, true);
panel.addEventListener("keyup", isolatePanelKeyboardEvent, true);
panel.addEventListener("keypress", isolatePanelKeyboardEvent, true);

// Page interactions listeners
document.addEventListener("mouseover", (event) => {
  if (panel.contains(event.target)) {
    return;
  }
  if (window.highlightedElement) {
    window.highlightedElement.style.outline = "";
  }
  window.highlightedElement = event.target;
  window.highlightedElement.style.outline = "3px solid red";
});

document.addEventListener("click", async (event) => {
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

  window.selectedElementData = normalizeSelectionItem({
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

  // Load existing session state to append the new element
  await loadSessionState();

  window.selectedDomNodes = [...(window.selectedDomNodes || []), element];
  window.selectedElements = [...(window.selectedElements || []), window.selectedElementData];

  let selectedScreenshot = await captureScreenshot();
  selectedScreenshot = await compressScreenshotDataUrl(selectedScreenshot);
  if (selectedScreenshot) {
    const screenshotLabel = `Фото ${window.selectedScreenshots.length + 1}: ${window.selectedElementData.tag}${window.selectedElementData.text || window.selectedElementData.ariaLabel || window.selectedElementData.placeholder ? ` - ${window.selectedElementData.text || window.selectedElementData.ariaLabel || window.selectedElementData.placeholder}` : ""}`;
    const selectedCount = window.selectedScreenshots.filter((item) => item.selected !== false).length;
    window.selectedScreenshots = [
      ...window.selectedScreenshots,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dataUrl: selectedScreenshot,
        label: screenshotLabel,
        selected: selectedCount < 3, // default first 3 selected
      },
    ];
  }

  updateVisualSelectionBadges();
  saveSessionState();

  console.log("Selected element saved locally:", window.selectedElementData);

  chrome.runtime.sendMessage({
    type: "SELECTION_UPDATED",
    selectedElements: window.selectedElements,
    selectedScreenshots: window.selectedScreenshots,
  }).catch(() => {});
}, true);

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (message.type === "GET_CURRENT_SELECTIONS") {
    sendResponse({
      selectedElements: window.selectedElements || [],
      selectedScreenshots: window.selectedScreenshots || [],
    });
    return true;
  }

  if (message.type === "CLEAR_HIGHLIGHTS") {
    clearVisualSelectionBadges();
    window.selectedDomNodes = [];
    return true;
  }

  if (message.type === "SELECTION_UPDATED") {
    loadSessionState().then(() => {
      renderSelectedElementsSummary();
      renderSelectedScreenshotsSummary();
      restoreDomNodesFromState();
      
      // Update text value inside panel
      const input = document.getElementById("bgt-input");
      if (input && window.selectedElements) {
        const selectionLines = window.selectedElements
          .map((item) => `- ${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
          .join("\n");
        const currentVal = input.value || "";
        if (!currentVal.startsWith("Tasks:")) {
          input.value = `Tasks:\n${selectionLines}\n\n` + currentVal;
        } else {
          const parts = currentVal.split("\n\n");
          const userPrompt = parts.slice(1).join("\n\n");
          input.value = `Tasks:\n${selectionLines}\n\n` + userPrompt;
        }
      }
    });
    return true;
  }

  if (message.type === "COMMAND_TRIGGERED") {
    if (message.command === "toggle-panel") {
      const panelLayer = document.querySelector("div[style*='z-index: 2147483647']");
      if (panelLayer && panelLayer.style.display === "none") {
        showPanel();
      } else {
        hidePanel();
      }
    } else if (message.command === "quick-screenshot") {
      let selectedScreenshot = await captureScreenshot();
      selectedScreenshot = await compressScreenshotDataUrl(selectedScreenshot);
      if (selectedScreenshot) {
        window.selectedScreenshots = [
          ...window.selectedScreenshots,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            dataUrl: selectedScreenshot,
            label: `Quick Screenshot ${window.selectedScreenshots.length + 1}`,
            selected: true,
          },
        ];
        saveSessionState();
        chrome.runtime.sendMessage({
          type: "SELECTION_UPDATED",
          selectedElements: window.selectedElements,
          selectedScreenshots: window.selectedScreenshots,
        }).catch(() => {});
      }
    }
  }
});

function restoreDomNodesFromState() {
  window.selectedDomNodes = [];
  const elements = window.selectedElements || [];
  elements.forEach((item) => {
    let match = null;
    if (item.id) {
      match = document.getElementById(item.id);
    }
    if (!match && item.text) {
      const candidates = Array.from(document.getElementsByTagName(item.tag));
      match = candidates.find((el) => (el.innerText || el.textContent || "").trim() === item.text.trim());
    }
    if (match) {
      window.selectedDomNodes.push(match);
    } else {
      window.selectedDomNodes.push(null);
    }
  });
  updateVisualSelectionBadges();
}

// Load session state on startup and save input changes
loadSessionState().then((loaded) => {
  if (loaded) {
    renderSelectedElementsSummary();
    renderSelectedScreenshotsSummary();
    restoreDomNodesFromState();
  }
  
  // Connect input keystrokes
  input?.addEventListener("input", saveSessionState);
  settingRules?.addEventListener("input", saveSessionState);
});