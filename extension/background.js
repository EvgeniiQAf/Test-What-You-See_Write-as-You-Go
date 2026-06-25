console.log("Background service worker loaded");

const DRAFT_SEQUENCE_KEY = "bgtDraftSequence";

const getNextDraftSequence = async () => {
  const data = await chrome.storage.local.get([DRAFT_SEQUENCE_KEY]);
  const current = Number(data[DRAFT_SEQUENCE_KEY] || 0);
  const next = current + 1;

  await chrome.storage.local.set({
    [DRAFT_SEQUENCE_KEY]: next,
  });

  return next;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 18 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            screenshot: null,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        sendResponse({
          screenshot: dataUrl
        });
      }
    );

    return true;
  }

  if (message.type === "GET_NEXT_DRAFT_SEQUENCE") {
    getNextDraftSequence()
      .then((sequence) => {
        sendResponse({ sequence });
      })
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message.type === "SAVE_DRAFT_JSON") {
    const fileName = message.fileName || "testmo-draft.json";
    const jsonContent = typeof message.jsonContent === "string" ? message.jsonContent : "{}";
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}`;

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: fileName,
        saveAs: false,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        sendResponse({
          ok: true,
          downloadId,
        });
      },
    );

    return true;
  }
});