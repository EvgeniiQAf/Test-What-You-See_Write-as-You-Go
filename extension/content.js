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

  // Load existing session state to align all tab indices (lightweight, no screenshots)
  await loadSessionState();
  restoreDomNodesFromState(false);

  window.selectedDomNodes.push(element);
  window.selectedElements.push(window.selectedElementData);

  // Wait 100ms for layout & active tab capture to settle down
  await new Promise((r) => setTimeout(r, 100));

  let selectedScreenshot = await captureScreenshot();

  // Send element and screenshot directly to Side Panel
  chrome.runtime.sendMessage({
    type: "ELEMENT_SELECTED",
    element: window.selectedElementData,
    screenshot: selectedScreenshot
  }).catch(() => {});

  updateVisualSelectionBadges();

  console.log("Selected element saved locally:", window.selectedElementData);
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

function pushRecordedAction(action) {
  chrome.storage.local.get(["bgt-session-state"], (result) => {
    const state = result?.["bgt-session-state"] || {};
    const recordedActions = state.recordedActions || [];
    recordedActions.push(action);
    
    if (recordedActions.length > 50) {
      recordedActions.shift();
    }
    
    state.recordedActions = recordedActions;
    chrome.storage.local.set({ "bgt-session-state": state }, () => {
      console.log("[DEBUG] Recorded action:", action);
      chrome.runtime.sendMessage({ type: "SELECTION_UPDATED" }).catch(() => {});
    });
  });
}

document.addEventListener("click", (event) => {
  if (event.shiftKey) return;

  const element = event.target;
  const tag = element.tagName.toLowerCase();
  
  if (element.closest(".bgt-element-badge")) {
    return;
  }

  const isInteractive = ["button", "a", "input", "select", "textarea"].includes(tag) || 
                       element.getAttribute("role") === "button" ||
                       window.getComputedStyle(element).cursor === "pointer" ||
                       element.closest("button") ||
                       element.closest("a");

  if (!isInteractive) return;

  const type = element.getAttribute("type") || "";
  if ((tag === "input" && ["text", "email", "password", "search", "tel", "number"].includes(type)) || tag === "textarea") {
    return;
  }

  const label = (element.innerText || element.textContent || "").trim().slice(0, 100) || 
                element.getAttribute("aria-label")?.trim() || 
                element.getAttribute("placeholder")?.trim() || 
                "";

  const action = {
    type: "click",
    tag,
    label,
    id: element.id || "",
    url: window.location.href,
    timestamp: Date.now()
  };

  pushRecordedAction(action);
}, true);

document.addEventListener("change", (event) => {
  const element = event.target;
  const tag = element.tagName.toLowerCase();
  if (tag !== "input" && tag !== "textarea" && tag !== "select") return;

  const isPassword = element.getAttribute("type") === "password";
  const value = isPassword ? "••••••••" : element.value;

  const label = element.getAttribute("aria-label")?.trim() || 
                element.getAttribute("placeholder")?.trim() || 
                element.id || 
                element.name || 
                "";

  const action = {
    type: "input",
    tag,
    label,
    value: String(value).slice(0, 200),
    url: window.location.href,
    timestamp: Date.now()
  };

  pushRecordedAction(action);
}, true);