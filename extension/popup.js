console.log("Chrome Side Panel loaded");

const root = document.getElementById("bgt-app-root");
if (root) {
  root.innerHTML = mainPanelHtml;
  initializeUiPanelListeners();
}

// Adjust UI for Side Panel mode
const header = document.querySelector(".bgt-header") || document.getElementById("bgt-header");
if (header) {
  const titleSpan = header.querySelector("span");
  if (titleSpan) {
    titleSpan.textContent = "TWYS QA Helper (Side Panel)";
  }
}

// Hide window actions in side panel mode
const detachBtn = document.getElementById("bgt-detach-window");
if (detachBtn) {
  detachBtn.style.display = "none";
}
const closeBtn = document.getElementById("bgt-close");
if (closeBtn) {
  closeBtn.style.display = "none";
}

function updateInputTasksPrefix() {
  const input = document.getElementById("bgt-input");
  if (!input) return;

  const selectionLines = (window.selectedElements || [])
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
  saveSessionState();
}

// Load session state on startup
loadSessionState().then(() => {
  renderSelectedElementsSummary();
  renderSelectedScreenshotsSummary();
  
  // Save state on input changes
  const input = document.getElementById("bgt-input");
  const rules = document.getElementById("bgt-setting-rules");
  input?.addEventListener("input", saveSessionState);
  rules?.addEventListener("input", saveSessionState);
});

// Listen for broadcast messages from content scripts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "ELEMENT_SELECTED") {
    loadSessionState().then(() => {
      // Append element metadata
      window.selectedElements = [...(window.selectedElements || []), message.element];

      // Append screenshot metadata if present
      if (message.screenshot) {
        const screenshotLabel = `Фото ${window.selectedScreenshots.length + 1}: ${message.element.tag}${message.element.text || message.element.ariaLabel || message.element.placeholder ? ` - ${message.element.text || message.element.ariaLabel || message.element.placeholder}` : ""}`;
        const selectedCount = window.selectedScreenshots.filter((item) => item.selected !== false).length;
        window.selectedScreenshots = [
          ...window.selectedScreenshots,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            dataUrl: message.screenshot,
            label: screenshotLabel,
            selected: selectedCount < 3, // default first 3 selected
          },
        ];
      }

      saveSessionState();
      renderSelectedElementsSummary();
      renderSelectedScreenshotsSummary();
      updateInputTasksPrefix();

      // Broadcast update to all content scripts to redraw highlights
      chrome.runtime.sendMessage({ type: "SELECTION_UPDATED" }).catch(() => {});
    });
  }

  if (message.type === "SELECTION_UPDATED") {
    loadSessionState().then(() => {
      renderSelectedElementsSummary();
      renderSelectedScreenshotsSummary();
      updateInputTasksPrefix();
    });
  }
});
