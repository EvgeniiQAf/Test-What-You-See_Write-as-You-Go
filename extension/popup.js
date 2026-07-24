console.log("Detached floating popup window loaded");

const root = document.getElementById("bgt-app-root");
if (root) {
  root.innerHTML = mainPanelHtml;
  initializeUiPanelListeners();
}

// Adjust UI for standalone window mode
const header = document.querySelector(".bgt-header");
if (header) {
  const titleSpan = header.querySelector("span");
  if (titleSpan) {
    titleSpan.textContent = "Browser GPT Testmo Helper (Floating Window)";
  }
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
    });
  }
});
