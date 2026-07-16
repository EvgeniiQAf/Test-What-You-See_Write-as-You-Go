// Screenshot management for QA Helper

function renderSelectedScreenshotsSummary() {
  const selectedScreenshotsBlock = document.getElementById("bgt-selected-screenshots");
  if (!selectedScreenshotsBlock) return;

  if (!window.selectedScreenshots.length) {
    selectedScreenshotsBlock.textContent = "Фото ще не вибрано";
    return;
  }

  const selectedCount = window.selectedScreenshots.filter((item) => item.selected !== false).length;
  selectedScreenshotsBlock.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">Фото для відправки (${selectedCount}/${MAX_SELECTED_SCREENSHOTS})</div>
    <div style="margin-bottom:6px; color:#6b7280;">Можна відмітити до ${MAX_SELECTED_SCREENSHOTS}. Кліків і скріншотів може бути скільки завгодно.</div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${window.selectedScreenshots
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
      if (!screenshotId) return;

      if (!target.checked) {
        window.selectedScreenshots = window.selectedScreenshots.map((item) => (
          item.id === screenshotId ? { ...item, selected: false } : item
        ));
        renderSelectedScreenshotsSummary();
        return;
      }

      const currentlySelected = window.selectedScreenshots.filter((item) => item.selected !== false).length;
      if (currentlySelected >= MAX_SELECTED_SCREENSHOTS) {
        target.checked = false;
        addMessage("assistant", `Можна вибрати лише ${MAX_SELECTED_SCREENSHOTS} фото для відправки.`);
        setStatus(`обрано максимум ${MAX_SELECTED_SCREENSHOTS} фото`, "#b45309");
        return;
      }

      window.selectedScreenshots = window.selectedScreenshots.map((item) => (
        item.id === screenshotId ? { ...item, selected: Boolean(target.checked) } : item
      ));

      renderSelectedScreenshotsSummary();
    });
  });
}

function addScreenshotMessage(screenshotDataUrl) {
  const chatBlock = document.getElementById("bgt-chat");
  if (!chatBlock) return;

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
    chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" }, async (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Capture tab runtime error:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      const dataUrl = response?.dataUrl || null;
      if (!dataUrl) {
        resolve(null);
        return;
      }

      const compressed = await compressScreenshotDataUrl(dataUrl);
      resolve(compressed);
    });
  });
}
