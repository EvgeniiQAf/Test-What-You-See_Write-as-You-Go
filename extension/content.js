console.log("Browser GPT Testmo Helper loaded (Side Panel Command Center Mode)");

// Page interactions listeners
document.addEventListener("mouseover", (event) => {
  if (window.highlightedElement) {
    window.highlightedElement.style.outline = "";
  }
  window.highlightedElement = event.target;
  window.highlightedElement.style.outline = "3px solid red";
});

document.addEventListener("click", async (event) => {
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

  if (message.type === "COMMAND_TRIGGERED") {
    if (message.command === "quick-screenshot") {
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

// Load session state on startup
loadSessionState().then((loaded) => {
  if (loaded) {
    restoreDomNodesFromState();
  }
});