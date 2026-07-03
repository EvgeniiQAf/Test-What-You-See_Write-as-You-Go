export function createPanel() {
  const panelLayer = document.createElement("div");
  const panel = document.createElement("div");

  panel.innerHTML = `
    <div id="bgt-header" style="font-weight: 700; margin-bottom: 8px; cursor: move; user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
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

    <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:12px; color:#374151; user-select:none;">
      <input id="bgt-generate-tests" type="checkbox" style="margin:0;" />
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

  return { panel, panelLayer, reopenButton };
}

export function setupPanelEvents(panel, panelLayer, reopenButton, input) {
  const panelHeader = document.getElementById("bgt-header");
  const closeButton = document.getElementById("bgt-close");

  const isolatePanelKeyboardEvent = (event) => {
    event.stopPropagation();
  };

  panel.addEventListener("keydown", isolatePanelKeyboardEvent);
  panel.addEventListener("keyup", isolatePanelKeyboardEvent);
  panel.addEventListener("keypress", isolatePanelKeyboardEvent);

  input.addEventListener("keydown", isolatePanelKeyboardEvent);
  input.addEventListener("keyup", isolatePanelKeyboardEvent);
  input.addEventListener("keypress", isolatePanelKeyboardEvent);

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
}

export function addMessage(role, text, chatBlock, options = {}) {
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

export function setRequestUiLocked(locked, sendButton, addTestButton, input) {
  sendButton.disabled = locked;
  addTestButton.disabled = locked;
  input.disabled = locked;

  sendButton.style.opacity = locked ? "0.65" : "1";
  addTestButton.style.opacity = locked ? "0.65" : "1";
  input.style.opacity = locked ? "0.8" : "1";

  sendButton.style.cursor = locked ? "not-allowed" : "pointer";
  addTestButton.style.cursor = locked ? "not-allowed" : "pointer";
}
