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
  if (message.type === "SELECTION_UPDATED") {
    loadSessionState().then(() => {
      renderSelectedElementsSummary();
      renderSelectedScreenshotsSummary();
      updateInputTasksPrefix();
    });
  }
});
