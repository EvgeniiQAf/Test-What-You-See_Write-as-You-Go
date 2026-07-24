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

  if (message.type === "OPEN_FLOATING_WINDOW") {
    const left = Math.max(10, Math.round(message.screenX || 100));
    const top = Math.max(10, Math.round(message.screenY || 100));

    chrome.windows.create(
      {
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        left: left,
        top: top,
        width: 550,
        height: 760,
        focused: true,
      },
      (createdWindow) => {
        sendResponse({ ok: true, windowId: createdWindow?.id });
      }
    );

    return true;
  }

  if (message.type === "MAKE_BACKEND_REQUEST") {
    const fetchOptions = {
      method: message.method || "POST",
      headers: {
        "Content-Type": "application/json"
      }
    };
    if (message.payload) {
      fetchOptions.body = JSON.stringify(message.payload);
    }

    fetch(message.endpoint, fetchOptions)
      .then(async (response) => {
        const text = await response.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { reply: text };
        }
        sendResponse({
          ok: response.ok,
          status: response.status,
          data: data
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: "COMMAND_TRIGGERED", command });
    }
  });
});