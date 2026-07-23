// Utility functions for QA Helper

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

function isLikelyTestRequest(text) {
  const normalized = String(text || "").toLowerCase();

  const explicitCountPattern = /\b\d{1,2}\s*(test\s*cases?|tests?|тест\s*кейс(и|ів)?|тест(и|ів)?|steps?|крок(и|ів)?|степ(и|ів)?)\b/u;
  if (explicitCountPattern.test(normalized)) {
    return true;
  }

  const testIntentPattern = /(зроби\s+.*тест|згенеруй\s+.*тест|test\s*plan|test\s*cases?|qa\s*test|тест(овий|ові)?\s+план|тести\s+для|tests?\s+for|for\s+this\s+block|for\s+this\s+element|на\s+твій\s+роздум|на\s+свій\s+розсуд)/iu;
  return testIntentPattern.test(normalized);
}

function compressHtml(htmlString) {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const root = doc.body;

    function prune(node) {
      if (node.nodeType === 1) { // ELEMENT_NODE
        const tag = node.tagName.toLowerCase();
        if (["script", "style", "svg", "path", "g", "rect", "circle", "polygon", "polyline", "line", "ellipse", "use", "symbol", "defs", "mask", "iframe", "noscript", "link", "meta"].includes(tag)) {
          node.remove();
          return;
        }

        if (tag === "tbody") {
          const rows = Array.from(node.querySelectorAll("tr"));
          if (rows.length > 2) {
            rows.slice(2).forEach(r => r.remove());
          }
        }

        if (tag === "ul" || tag === "ol") {
          const items = Array.from(node.children).filter(c => c.tagName.toLowerCase() === "li");
          if (items.length > 3) {
            items.slice(3).forEach(item => item.remove());
          }
        }

        const attributesToRemove = [];
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i].name;
          if (attr.startsWith("data-") && !attr.startsWith("data-testid") && !attr.startsWith("data-qa")) {
            attributesToRemove.push(attr);
          } else if (attr === "style" || attr.startsWith("xmlns") || attr.startsWith("xml:")) {
            attributesToRemove.push(attr);
          }
        }
        attributesToRemove.forEach(attr => node.removeAttribute(attr));

        const children = Array.from(node.childNodes);
        children.forEach(child => prune(child));
      } else if (node.nodeType === 3) { // TEXT_NODE
        const txt = node.nodeValue || "";
        if (txt.trim().length > 100) {
          node.nodeValue = txt.slice(0, 100) + "...";
        }
      }
    }

    Array.from(root.childNodes).forEach(child => prune(child));
    return cleaned;
  } catch (err) {
    console.warn("HTML compression error:", err);
    return htmlString.slice(0, 8000) + "... (fallback truncation)";
  }
}

function formatTestCaseMarkdown(testCase) {
  if (!testCase) return "";

  const titleEn = testCase.title?.en || "";
  const titleUa = testCase.title?.ua || "";
  const preconditionsEn = (testCase.preconditions?.en || []).map((p) => `- ${p}`).join("\n");
  const preconditionsUa = (testCase.preconditions?.ua || []).map((p) => `- ${p}`).join("\n");

  const stepsFormatted = (testCase.steps || []).map((s, i) => {
    const stepEn = s.step?.en || "";
    const stepUa = s.step?.ua || "";
    const expEn = (s.expectedResults?.en || []).map((e) => `  - ${e}`).join("\n");
    const expUa = (s.expectedResults?.ua || []).map((e) => `  - ${e}`).join("\n");

    return `### Step ${i + 1}
**EN:** ${stepEn}
**Expected:**
${expEn}

**UA:** ${stepUa}
**Очікується:**
${expUa}`;
  }).join("\n\n");

  return `# ${titleEn} / ${titleUa}

## Preconditions (EN)
${preconditionsEn || "N/A"}

## Передумови (UA)
${preconditionsUa || "N/A"}

## Steps / Кроки
${stepsFormatted}`;
}

function downloadTestCaseCsv(testCase) {
  if (!testCase) return;

  const rows = [
    ["Title (EN)", "Title (UA)", "Preconditions (EN)", "Step #", "Step (EN)", "Step (UA)", "Expected (EN)", "Expected (UA)"]
  ];

  const titleEn = testCase.title?.en || "";
  const titleUa = testCase.title?.ua || "";
  const preEn = (testCase.preconditions?.en || []).join("; ");

  (testCase.steps || []).forEach((s, idx) => {
    const stepEn = s.step?.en || "";
    const stepUa = s.step?.ua || "";
    const expEn = (s.expectedResults?.en || []).join("; ");
    const expUa = (s.expectedResults?.ua || []).join("; ");

    rows.push([
      idx === 0 ? titleEn : "",
      idx === 0 ? titleUa : "",
      idx === 0 ? preEn : "",
      String(idx + 1),
      stepEn,
      stepUa,
      expEn,
      expUa
    ]);
  });

  const csvContent = rows
    .map((row) => row.map((field) => `"${String(field || "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `test-case-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
    outerHTML: compressHtml(normalizeStringValue(item?.outerHTML)),
    url: normalizeStringValue(item?.url),
    pageTitle: normalizeStringValue(item?.pageTitle),
  };
}

function normalizeSelectionList(items) {
  return (Array.isArray(items) ? items : []).map((item) => normalizeSelectionItem(item));
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          let msg = chrome.runtime.lastError.message;
          if (msg.includes("Extension context invalidated")) {
            msg = "Розширення було оновлено в браузері. Перезавантажте поточну сторінку (F5).";
          }
          reject(new Error(msg));
          return;
        }
        resolve(response || {});
      });
    } catch (error) {
      let msg = error.message;
      if (msg.includes("Extension context invalidated")) {
        msg = "Розширення було оновлено в браузері. Перезавантажте поточну сторінку (F5).";
      }
      reject(new Error(msg));
    }
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
      folder_id: window.activeFolderId || 0,
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
