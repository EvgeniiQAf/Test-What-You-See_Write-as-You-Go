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

// Poll or listen for selections from active tab
async function syncFromActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: false });
    const activeTab = tabs[0];
    if (!activeTab?.id) return;

    chrome.tabs.sendMessage(activeTab.id, { type: "GET_CURRENT_SELECTIONS" }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      if (response.selectedElements && Array.isArray(response.selectedElements)) {
        window.selectedElements = response.selectedElements;
        renderSelectedElementsSummary();
      }
      if (response.selectedScreenshots && Array.isArray(response.selectedScreenshots)) {
        window.selectedScreenshots = response.selectedScreenshots;
        renderSelectedScreenshotsSummary();
      }
    });
  } catch (err) {
    // Ignore tab query errors
  }
}

// Listen for broadcast messages from content scripts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SELECTION_UPDATED") {
    if (message.selectedElements) {
      window.selectedElements = message.selectedElements;
      renderSelectedElementsSummary();
    }
    if (message.selectedScreenshots) {
      window.selectedScreenshots = message.selectedScreenshots;
      renderSelectedScreenshotsSummary();
    }
  }
});

// Periodic sync every 1 second
setInterval(syncFromActiveTab, 1000);
syncFromActiveTab();
