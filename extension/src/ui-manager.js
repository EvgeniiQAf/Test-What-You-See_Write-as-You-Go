// UI Interaction and Elements Manager for QA Helper

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function hidePanel(sync = true) {
  const panelLayer = document.querySelector("div[style*='z-index: 2147483647']");
  const reopenButton = document.getElementById("bgt-reopen");
  if (panelLayer) panelLayer.style.display = "none";
  if (reopenButton) reopenButton.style.display = "block";
  if (sync) {
    chrome.storage.local.set({ "bgt-panel-visible": false }, () => {
      chrome.runtime.sendMessage({ type: "VISIBILITY_UPDATED", visible: false }).catch(() => {});
    });
  }
}

function showPanel(sync = true) {
  const panelLayer = document.querySelector("div[style*='z-index: 2147483647']");
  const reopenButton = document.getElementById("bgt-reopen");
  const input = document.getElementById("bgt-input");
  if (panelLayer) panelLayer.style.display = "block";
  if (reopenButton) reopenButton.style.display = "none";
  if (input) input.focus();
  if (sync) {
    chrome.storage.local.set({ "bgt-panel-visible": true }, () => {
      chrome.runtime.sendMessage({ type: "VISIBILITY_UPDATED", visible: true }).catch(() => {});
    });
  }
}

function initializeUiPanelListeners() {
  const panelHeader = document.getElementById("bgt-header");
  const panel = document.getElementById("bgt-app-root") || document.querySelector("div[style*='z-index: 2147483647']");
  const closeButton = document.getElementById("bgt-close");
  const reopenButton = document.getElementById("bgt-reopen");
  const input = document.getElementById("bgt-input");
  const generateTestsCheckbox = document.getElementById("bgt-generate-tests");
  const addTestButton = document.getElementById("bgt-add-test");
  const sendButton = document.getElementById("bgt-send");
  const toggleSettingsButton = document.getElementById("bgt-toggle-settings");
  const settingsPanel = document.getElementById("bgt-settings-panel");
  const settingFormat = document.getElementById("bgt-setting-format");
  const settingLang = document.getElementById("bgt-setting-lang");
  const settingLlm = document.getElementById("bgt-setting-llm");
  const settingRules = document.getElementById("bgt-setting-rules");

  if (panelHeader && panel) {
    setupDragAndDrop(panelHeader, panel);
  }
  setupPresetListeners();
  applySavedSettingsToUi();

  const clearSessionButton = document.getElementById("bgt-clear-session");
  clearSessionButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (confirm("Очистити всі поточні виділення та почати новий тест-кейс?")) {
      clearSessionState();
    }
  });

  closeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isPopupContext = window.location.protocol === "chrome-extension:";
    if (isPopupContext) {
      window.close();
    } else {
      hidePanel();
    }
  });

  reopenButton?.addEventListener("click", () => {
    showPanel();
  });

  toggleSettingsButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!settingsPanel) return;
    const isHidden = settingsPanel.style.display === "none";
    settingsPanel.style.display = isHidden ? "flex" : "none";
    toggleSettingsButton.style.background = isHidden ? "#e5e7eb" : "#fff";
  });

  [settingFormat, settingLang, settingLlm].forEach((el) => {
    el?.addEventListener("change", () => {
      if (!settingFormat || !settingLang || !settingLlm || !settingRules) return;
      saveSettings({
        format: settingFormat.value,
        lang: settingLang.value,
        llm: settingLlm.value,
        rules: settingRules.value,
      });
    });
  });

  settingRules?.addEventListener("input", () => {
    if (!settingFormat || !settingLang || !settingLlm || !settingRules) return;
    saveSettings({
      format: settingFormat.value,
      lang: settingLang.value,
      llm: settingLlm.value,
      rules: settingRules.value,
    });
  });

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingAudio = false;

  const voiceButton = document.getElementById("bgt-voice");
  if (voiceButton) {
    voiceButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleVoiceRecording();
    });
  }

  function toggleVoiceRecording() {
    if (isRecordingAudio) {
      stopAudioRecording();
    } else {
      startAudioRecording();
    }
  }

  function findActiveWebTab(callback) {
    chrome.tabs.query({ active: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        callback(null);
        return;
      }
      const webTab = tabs.find((t) => t.url && /^https?:\/\//i.test(t.url)) || tabs[0];
      callback(webTab || null);
    });
  }

  async function startAudioRecording() {
    setStatus("Запуск аудіозапису...", "#b45309");

    findActiveWebTab((activeTab) => {
      if (!activeTab || !activeTab.id) {
        startLocalAudioRecording();
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: "START_AUDIO_RECORDING" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[VOICE TAB ERROR] Injecting content script into active tab:", activeTab.id);
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              files: [
                "src/state.js",
                "src/utils.js",
                "src/storage.js",
                "src/ui-templates.js",
                "src/ui-manager.js",
                "src/screenshot-manager.js",
                "src/backend-client.js",
                "content.js",
              ],
            },
            () => {
              if (chrome.runtime.lastError) {
                startLocalAudioRecording();
              } else {
                chrome.tabs.sendMessage(activeTab.id, { type: "START_AUDIO_RECORDING" }, (retryRes) => {
                  if (chrome.runtime.lastError) {
                    startLocalAudioRecording();
                  }
                });
              }
            }
          );
        }
      });
    });
  }

  function stopAudioRecording() {
    findActiveWebTab((activeTab) => {
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: "STOP_AUDIO_RECORDING" }).catch(() => {});
      }
    });

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (e) {}
    }
  }

  async function startLocalAudioRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Мікрофон не підтримується у цьому браузері", "#b91c1c");
      return;
    }

    try {
      setStatus("Запит дозволу на мікрофон...", "#b45309");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunks = [];
      const options = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? { mimeType: "audio/mp4" }
        : {};

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        isRecordingAudio = true;
        if (voiceButton) {
          voiceButton.style.background = "#fee2e2";
          voiceButton.style.borderColor = "#ef4444";
          voiceButton.textContent = "🔴";
        }
        setStatus("🔴 Запис аудіо... Натисніть кнопку ще раз для відправки", "#b45309");
      };

      mediaRecorder.onstop = async () => {
        isRecordingAudio = false;
        stream.getTracks().forEach((track) => track.stop());

        if (voiceButton) {
          voiceButton.style.background = "#f3f4f6";
          voiceButton.style.borderColor = "#d1d5db";
          voiceButton.textContent = "🎙️";
        }

        if (audioChunks.length === 0) {
          setStatus("Аудіо не записано, спробуйте ще раз", "#b91c1c");
          return;
        }

        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        if (audioBlob.size < 500) {
          setStatus("Запис занадто короткий", "#b45309");
          return;
        }

        const base64Audio = await blobToBase64(audioBlob);
        sendAudioToWhisper(base64Audio);
      };

      mediaRecorder.start(250);
    } catch (err) {
      console.warn("[START LOCAL AUDIO ERROR]", err);
      setStatus("Відкрито вкладку дозволу на мікрофон!", "#ef4444");
      try {
        chrome.runtime.sendMessage({ type: "OPEN_VOICE_PERMISSION" }).catch(() => {
          window.open(chrome.runtime.getURL("voice-permission.html"), "_blank");
        });
      } catch (e) {
        window.open(chrome.runtime.getURL("voice-permission.html"), "_blank");
      }
    }
  }

  async function sendAudioToWhisper(base64Audio) {
    setStatus("⏳ Розшифровка голосу (Whisper API)...", "#b45309");

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "MAKE_BACKEND_REQUEST",
            endpoint: "http://localhost:3000/api/transcribe",
            method: "POST",
            payload: { audio: base64Audio },
          },
          (res) => resolve(res)
        );
      });

      if (response && response.ok && response.data?.text) {
        const transcribedText = response.data.text;
        handleVoiceResult(transcribedText, true);
        setStatus("Голос розпізнано", "#15803d");
      } else {
        const err = response?.data?.error || response?.error || "Помилка розшифровки";
        console.error("[WHISPER ERROR]", err);
        setStatus(`Whisper error: ${err}`, "#ef4444");
      }
    } catch (err) {
      console.error("[AUDIO TRANSCRIBE ERROR]", err);
      setStatus("Не вдалося надіслати аудіо", "#ef4444");
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "VOICE_RESULT") {
      if (message.text) {
        handleVoiceResult(message.text, true);
        setStatus("Голос розпізнано", "#15803d");
      }
    } else if (message.type === "AUDIO_BLOB_READY") {
      if (message.audio) {
        sendAudioToWhisper(message.audio);
      }
    } else if (message.type === "VOICE_STATUS") {
      if (message.statusText) {
        if (message.statusText !== "idle") {
          setStatus(message.statusText, message.isError ? "#ef4444" : "#b45309");
        } else {
          setStatus("idle");
        }
      }
      if (typeof message.isRecording === "boolean") {
        isRecordingAudio = message.isRecording;
        if (voiceButton) {
          voiceButton.style.background = message.isRecording ? "#fee2e2" : "#f3f4f6";
          voiceButton.style.borderColor = message.isRecording ? "#ef4444" : "#d1d5db";
          voiceButton.textContent = message.isRecording ? "🔴" : "🎙️";
        }
      }
    }
  });

  let lastProcessedVoiceText = "";

  function handleVoiceResult(text, isFinal = false) {
    const input = document.getElementById("bgt-input");
    if (!input || !text) return;

    const trimmedText = String(text).trim();
    if (!trimmedText) return;

    if (trimmedText === lastProcessedVoiceText) {
      console.log("[DEBUG] Ignoring duplicate voice result:", trimmedText);
      return;
    }

    lastProcessedVoiceText = trimmedText;
    setTimeout(() => {
      if (lastProcessedVoiceText === trimmedText) {
        lastProcessedVoiceText = "";
      }
    }, 4000);

    console.log("[DEBUG] Voice result from Whisper:", trimmedText);
    const commandRegex = /(?:тест\s*кейс|тест|test\s*case|test)\s*(один|два|три|чотири|п['’]ять|шість|сім|вісім|дев['’]ять|десять|\d+)/iu;
    const match = trimmedText.match(commandRegex);

    if (match) {
      const numWord = match[1].toLowerCase();
      let num = parseInt(numWord, 10);
      if (isNaN(num)) {
        const numbersMap = {
          "один": 1, "one": 1,
          "два": 2, "two": 2,
          "три": 3, "three": 3,
          "чотири": 4, "four": 4,
          "п'ять": 5, "п’ять": 5, "five": 5,
          "шість": 6, "six": 6,
          "сім": 7, "seven": 7,
          "вісім": 8, "eight": 8,
          "дев'ять": 9, "дев’ять": 9, "nine": 9,
          "десять": 10, "ten": 10
        };
        num = numbersMap[numWord] || 1;
      }

      const testMarker = `Test ${num}: `;
      const cleanedText = trimmedText.replace(commandRegex, "").trim();
      
      const before = input.value.slice(0, input.selectionStart || 0);
      const after = input.value.slice(input.selectionEnd || 0);
      const needsNewLine = before.length > 0 && !before.endsWith("\n");
      
      input.value = `${before}${needsNewLine ? "\n" : ""}${testMarker}${cleanedText}${after}`;
      window.nextInlineTestNumber = num + 1;
      updateAddTestButtonLabel();
    } else {
      const before = input.value.slice(0, input.selectionStart || 0);
      const after = input.value.slice(input.selectionEnd || 0);
      const space = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
      input.value = `${before}${space}${trimmedText}${after}`;
    }

    input.focus();
    saveSessionState();
  }

  sendButton?.addEventListener("click", () => {
    sendPrompt();
  });

  addTestButton?.addEventListener("click", insertTestLabel);
  updateAddTestButtonLabel();

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendPrompt();
    }
  });

  input?.addEventListener("focus", () => {
    setStatus("input focused", "#15803d");
  }, true);

  input?.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
}

function openFloatingWindow(screenX, screenY) {
  hidePanel();
  chrome.runtime.sendMessage({
    type: "OPEN_FLOATING_WINDOW",
    screenX: screenX ?? (window.screenX + 100),
    screenY: screenY ?? (window.screenY + 100),
  });
}

function setupDragAndDrop(panelHeader, panel) {
  if (!panelHeader || !panel) return;

  const detachBtn = document.getElementById("bgt-detach-window");
  if (detachBtn) {
    detachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFloatingWindow(e.screenX, e.screenY);
    });
  }

  let autoDetached = false;

  panelHeader.addEventListener("mousedown", (event) => {
    if (event.target?.id === "bgt-detach-window" || event.target?.id === "bgt-close" || event.target?.id === "bgt-toggle-settings") return;
    isDragging = true;
    autoDetached = false;
    dragOffsetX = event.clientX - panel.offsetLeft;
    dragOffsetY = event.clientY - panel.offsetTop;
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const newLeft = event.clientX - dragOffsetX;
    const newTop = event.clientY - dragOffsetY;

    if (!autoDetached && (event.clientX < 15 || event.clientX > window.innerWidth - 15 || event.clientY < 15 || event.clientY > window.innerHeight - 15)) {
      autoDetached = true;
      isDragging = false;
      openFloatingWindow(event.screenX, event.screenY);
      return;
    }

    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      const isPopupContext = window.location.protocol === "chrome-extension:";
      if (!isPopupContext) {
        const top = panel.style.top;
        const left = panel.style.left;
        chrome.storage.local.set({ "bgt-panel-position": { top, left } }, () => {
          chrome.runtime.sendMessage({ type: "POSITION_UPDATED", top, left }).catch(() => {});
        });
      }
    }
  });
}

function setupPresetListeners() {
  const presetsBar = document.getElementById("bgt-presets-bar");
  if (!presetsBar) return;

  const presetTexts = {
    table: "1 тест на всі колонки таблиці. Окремий крок та ОР для кожного стовпця.",
    dropdown: "Перевірити обрати декілька варіантів, диселект елемента та очищення через хрестик.",
    form: "Перевірити обов'язкові поля, валідацію форматів та помилки при некоректних даних.",
    edge: "Перевірити граничні значення (Min/Max length), спецсимволи та некоректне введення."
  };

  presetsBar.querySelectorAll(".bgt-preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("bgt-input");
      const key = btn.getAttribute("data-preset");
      const text = presetTexts[key];
      if (input && text) {
        input.value = input.value ? `${input.value}\n${text}` : text;
        input.focus();
      }
    });
  });
}

function renderEdgeCaseSuggestions() {
  const suggestionsBar = document.getElementById("bgt-suggestions-bar");
  if (!suggestionsBar) return;

  const elements = window.selectedElements || [];
  if (!elements.length) {
    suggestionsBar.innerHTML = "";
    return;
  }

  const latest = elements[elements.length - 1];
  const tag = String(latest.tag || "").toLowerCase();
  const html = String(latest.outerHTML || "").toLowerCase();
  const suggestions = [];

  if (tag === "table" || tag === "thead" || tag === "tbody" || html.includes("<table")) {
    suggestions.push({ label: "💡 Verify All Columns", text: "1 тест на всі колонки таблиці. Окремий крок та ОР для кожного стовпця." });
  }

  if (tag === "select" || html.includes("role=\"combobox\"") || html.includes("dropdown") || html.includes("select")) {
    suggestions.push({ label: "💡 Deselect & Clear", text: "Перевірити вибір декількох варіантів, зняття виділення елемента та закриття через хрестик." });
  }

  if (tag === "input" || tag === "textarea" || html.includes("required") || html.includes("maxlength") || html.includes("placeholder")) {
    suggestions.push({ label: "💡 Required Field", text: "Перевірити спробу відправки порожнього обов'язкового поля та виведення повідомлення про помилку." });
    suggestions.push({ label: "💡 Max Length / Boundary", text: "Перевірити граничні значення (Min/Max length) та введення неприпустимих спецсимволів." });
  }

  if (tag === "button" || tag === "a" || html.includes("role=\"button\"")) {
    suggestions.push({ label: "💡 Hover & Active State", text: "Перевірити відображення кнопки, стан при наведенні (hover), доступність (enabled) та клікабельність." });
  }

  if (!suggestions.length) {
    suggestions.push({ label: "💡 Standard Verification", text: "Перевірити відображення елемента, правильність назви та реакцію на взаємодію." });
  }

  suggestionsBar.innerHTML = suggestions
    .map(
      (s) => `<button type="button" class="bgt-suggestion-chip" data-suggestion-text="${escapeHtml(s.text)}" style="all:unset; cursor:pointer; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:500;">${escapeHtml(s.label)}</button>`
    )
    .join("");

  suggestionsBar.querySelectorAll(".bgt-suggestion-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("bgt-input");
      const textToAppend = btn.getAttribute("data-suggestion-text");
      if (input && textToAppend) {
        input.value = input.value ? `${input.value}\n${textToAppend}` : textToAppend;
        input.focus();
      }
    });
  });
}

function clearVisualSelectionBadges() {
  document.querySelectorAll(".bgt-selection-badge-overlay").forEach((badge) => badge.remove());
}

function updateVisualSelectionBadges() {
  clearVisualSelectionBadges();

  const nodes = window.selectedDomNodes || [];
  nodes.forEach((domNode, index) => {
    if (!domNode || !domNode.getBoundingClientRect) return;

    const rect = domNode.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const overlay = document.createElement("div");
    overlay.className = "bgt-selection-badge-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${Math.max(12, rect.width)}px`;
    overlay.style.height = `${Math.max(12, rect.height)}px`;
    overlay.style.border = "2px dashed #6366f1";
    overlay.style.borderRadius = "4px";
    overlay.style.boxShadow = "0 0 10px rgba(99, 102, 241, 0.5)";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483646";
    overlay.style.transition = "all 0.2s ease";

    const badge = document.createElement("span");
    badge.textContent = `${index + 1}`;
    badge.style.position = "absolute";
    badge.style.top = "-11px";
    badge.style.left = "-11px";
    badge.style.background = "linear-gradient(135deg, #6366f1, #8b5cf6)";
    badge.style.color = "#ffffff";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "bold";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "10px";
    badge.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
    badge.style.lineHeight = "1";

    overlay.appendChild(badge);
    document.body.appendChild(overlay);
  });
}

function renderRecordedActionsSummary() {
  const actionsBlock = document.getElementById("bgt-recorded-actions");
  if (!actionsBlock) return;

  const actions = window.recordedActions || [];
  if (actions.length === 0) {
    actionsBlock.textContent = "Записані дії: 0";
    actionsBlock.style.whiteSpace = "normal";
    return;
  }

  const listText = actions
    .slice(-5)
    .map((a) => {
      if (a.type === "click") {
        return `👉 Клік: ${a.tag}${a.label ? ` "${a.label}"` : ""}`;
      } else if (a.type === "input") {
        return `✏️ Ввід: ${a.label ? `"${a.label}"` : a.tag} = "${a.value}"`;
      }
      return `${a.type}: ${a.label || a.tag}`;
    })
    .join("\n");

  actionsBlock.style.whiteSpace = "pre-wrap";
  actionsBlock.textContent = `Записані дії (${actions.length}):\n${listText}`;
}

function renderSelectedElementsSummary() {
  updateVisualSelectionBadges();
  renderEdgeCaseSuggestions();
  renderRecordedActionsSummary();

  const selectedElementBlock = document.getElementById("bgt-selected-element");
  if (!selectedElementBlock) return;

  if (!window.selectedElements.length) {
    selectedElementBlock.textContent = "Елементи не вибрано";
    clearVisualSelectionBadges();
    return;
  }

  const latest = window.selectedElements[window.selectedElements.length - 1];
  const summary = window.selectedElements
    .slice(-5)
    .map((item, index) => `${window.selectedElements.length - 4 + index > 0 ? `${window.selectedElements.length - 4 + index}. ` : ""}${item.tag}: ${item.text || item.ariaLabel || item.placeholder || "Element selected"}`)
    .join("\n");

  selectedElementBlock.textContent = `Задача:\n${summary}\n\nОстанній: ${latest.tag}: ${latest.text || latest.ariaLabel || latest.placeholder || "Елемент вибрано"}`;
}

function setStatus(text, color = "#6b7280") {
  const statusBlock = document.getElementById("bgt-status");
  if (statusBlock) {
    statusBlock.textContent = `Status: ${text}`;
    statusBlock.style.color = color;
  }
}

function updateAddTestButtonLabel() {
  const addTestButton = document.getElementById("bgt-add-test");
  if (addTestButton) {
    const displayNumber = Math.min(window.nextInlineTestNumber, MAX_TESTS);
    addTestButton.textContent = `Add Test Case #${displayNumber}`;
  }
}

function insertTestLabel() {
  const input = document.getElementById("bgt-input");
  if (!input) return;

  if (window.nextInlineTestNumber > MAX_TESTS) {
    setStatus("maximum 10 tests reached", "#b45309");
    addMessage("assistant", "Maximum 10 tests per prompt reached.");
    return;
  }

  const label = `Test ${window.nextInlineTestNumber}: `;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const needsNewLine = before.length > 0 && !before.endsWith("\n");
  const insertion = `${needsNewLine ? "\n" : ""}${label}`;

  input.value = `${before}${insertion}${after}`;
  const caretPosition = before.length + insertion.length;
  input.selectionStart = caretPosition;
  input.selectionEnd = caretPosition;

  addMessage("assistant", `Added ${label.trim()} marker.`);
  setStatus(`${label.trim()} inserted`, "#15803d");

  window.nextInlineTestNumber += 1;
  updateAddTestButtonLabel();
  input.focus();
}

function setTestModeHint(active, source = "manual") {
  const testModeHint = document.getElementById("bgt-test-mode-hint");
  const settingFormat = document.getElementById("bgt-setting-format");
  if (!testModeHint) return;

  if (!active) {
    testModeHint.textContent = "Mode: chat";
    testModeHint.style.color = "#6b7280";
    return;
  }

  const isBdd = settingFormat?.value === "bdd";
  const formatName = isBdd ? "BDD / Gherkin" : "test cases";

  testModeHint.textContent = source === "auto" ? `Mode: ${formatName} (auto-detected)` : `Mode: ${formatName}`;
  testModeHint.style.color = "#15803d";
}

function setRequestUiLocked(locked) {
  const sendButton = document.getElementById("bgt-send");
  const addTestButton = document.getElementById("bgt-add-test");
  const input = document.getElementById("bgt-input");
  
  if (sendButton) {
    sendButton.disabled = locked;
    sendButton.style.opacity = locked ? "0.65" : "1";
    sendButton.style.cursor = locked ? "not-allowed" : "pointer";
  }
  if (addTestButton) {
    addTestButton.disabled = locked;
    addTestButton.style.opacity = locked ? "0.65" : "1";
    addTestButton.style.cursor = locked ? "not-allowed" : "pointer";
  }
  if (input) {
    input.disabled = locked;
    input.style.opacity = locked ? "0.8" : "1";
  }
}
