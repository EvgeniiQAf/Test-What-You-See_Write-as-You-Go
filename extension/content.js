console.log("TWYS QA Helper loaded (Side Panel Command Center Mode)");

// Page interactions listeners
document.addEventListener("mouseover", (event) => {
  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
    if (window.highlightedElement) {
      window.highlightedElement.style.outline = "";
    }
    window.highlightedElement = event.target;
    window.highlightedElement.style.outline = "3px solid red";
  } catch (e) {}
});

document.addEventListener("click", async (event) => {
  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
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
  } catch (error) {
    console.debug("Extension context invalidated, skipping selection click", error);
  }
}, true);

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (message.type === "GET_CURRENT_SELECTIONS") {
    sendResponse({
      selectedElements: window.selectedElements || [],
      selectedScreenshots: window.selectedScreenshots || [],
    });
    return true;
  }

  if (message.type === "START_AUDIO_RECORDING") {
    startTabAudioRecording();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "STOP_AUDIO_RECORDING") {
    stopTabAudioRecording();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "REQUEST_MIC_PERMISSION") {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      sendResponse({ ok: false, error: "getUserMedia not supported on this page" });
      return true;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.warn("[TWYS] Microphone permission request denied in tab:", err);
        sendResponse({ ok: false, error: err.message || String(err) });
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
  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.storage.local.get(["bgt-session-state"], (result) => {
      if (chrome.runtime.lastError) return;
      const state = result?.["bgt-session-state"] || {};
      const recordedActions = state.recordedActions || [];
      recordedActions.push(action);
      
      if (recordedActions.length > 50) {
        recordedActions.shift();
      }
      
      state.recordedActions = recordedActions;
      chrome.storage.local.set({ "bgt-session-state": state }, () => {
        if (chrome.runtime.lastError) return;
        console.log("[DEBUG] Recorded action:", action);
        chrome.runtime.sendMessage({ type: "SELECTION_UPDATED" }).catch(() => {});
      });
    });
  } catch (error) {
    console.debug("Extension context invalidated, skipping action record", error);
  }
}

document.addEventListener("click", (event) => {
  if (!chrome.runtime || !chrome.runtime.id) return;
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
  if (!chrome.runtime || !chrome.runtime.id) return;
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

let tabMediaRecorder = null;
let tabAudioChunks = [];
let isTabAudioRecording = false;

function startTabAudioRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    chrome.runtime.sendMessage({
      type: "VOICE_STATUS",
      statusText: "Мікрофон не підтримується на цій сторінці",
      isError: true,
      isRecording: false,
    }).catch(() => {});
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      tabAudioChunks = [];
      const options = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? { mimeType: "audio/mp4" }
        : {};

      tabMediaRecorder = new MediaRecorder(stream, options);

      tabMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          tabAudioChunks.push(event.data);
        }
      };

      tabMediaRecorder.onstart = () => {
        isTabAudioRecording = true;
        chrome.runtime.sendMessage({
          type: "VOICE_STATUS",
          statusText: "🔴 Запис аудіо... Натисніть кнопку ще раз для відправки",
          isRecording: true,
        }).catch(() => {});
      };

      tabMediaRecorder.onstop = async () => {
        isTabAudioRecording = false;
        stream.getTracks().forEach((track) => track.stop());

        if (tabAudioChunks.length === 0) {
          chrome.runtime.sendMessage({
            type: "VOICE_STATUS",
            statusText: "Аудіо не записано, спробуйте ще раз",
            isError: true,
            isRecording: false,
          }).catch(() => {});
          return;
        }

        const mimeType = tabMediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(tabAudioChunks, { type: mimeType });

        if (audioBlob.size < 500) {
          chrome.runtime.sendMessage({
            type: "VOICE_STATUS",
            statusText: "Запис занадто короткий",
            isRecording: false,
          }).catch(() => {});
          return;
        }

        chrome.runtime.sendMessage({
          type: "VOICE_STATUS",
          statusText: "⏳ Розшифровка голосу (Whisper API)...",
          isRecording: false,
        }).catch(() => {});

        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result;

            chrome.runtime.sendMessage(
              {
                type: "MAKE_BACKEND_REQUEST",
                endpoint: "http://localhost:3000/api/transcribe",
                method: "POST",
                payload: { audio: base64Audio },
              },
              (response) => {
                if (response && response.ok && response.data?.text) {
                  chrome.runtime.sendMessage({
                    type: "VOICE_RESULT",
                    text: response.data.text,
                    isFinal: true,
                  }).catch(() => {});
                } else {
                  const err = response?.data?.error || response?.error || "Помилка розшифровки";
                  console.error("[WHISPER ERROR]", err);
                  chrome.runtime.sendMessage({
                    type: "VOICE_STATUS",
                    statusText: `Whisper error: ${err}`,
                    isError: true,
                    isRecording: false,
                  }).catch(() => {});
                }
              }
            );
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error("[TAB AUDIO CONVERT ERROR]", err);
        }
      };

      tabMediaRecorder.start(250);
    })
    .catch((err) => {
      console.warn("[TAB AUDIO MIC PERMISSION DENIED]", err);
      chrome.runtime.sendMessage({
        type: "VOICE_STATUS",
        statusText: "Будь ласка, дозвольте мікрофон у сповіщенні під адресною строкою!",
        isError: true,
        isRecording: false,
      }).catch(() => {});
    });
}

function stopTabAudioRecording() {
  isTabAudioRecording = false;
  if (tabMediaRecorder && tabMediaRecorder.state !== "inactive") {
    try {
      tabMediaRecorder.stop();
    } catch (e) {}
  }
}