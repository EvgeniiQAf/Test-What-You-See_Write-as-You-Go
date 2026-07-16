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
    outerHTML: normalizeStringValue(item?.outerHTML),
    url: normalizeStringValue(item?.url),
    pageTitle: normalizeStringValue(item?.pageTitle),
  };
}

function normalizeSelectionList(items) {
  return (Array.isArray(items) ? items : []).map((item) => normalizeSelectionItem(item));
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
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
