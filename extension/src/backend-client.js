// Backend communications layer for QA Helper

async function loadTmsConfig() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "MAKE_BACKEND_REQUEST",
          endpoint: "http://localhost:3000/api/config",
          method: "GET",
        },
        (res) => resolve(res)
      );
    });

    if (response && response.ok) {
      const result = response.data;
      window.activeTms = result?.activeTms || "testmo";
      window.activeFolderId = window.activeTms === "testmo" ? result?.testmoFolderId : result?.testomatSuiteId;
      console.log(`Loaded TMS Config: activeTms=${window.activeTms}, activeFolderId=${window.activeFolderId}`);
    }
  } catch (error) {
    console.warn("Failed to load TMS config from server:", error);
  }
}

async function sendPrompt() {
  if (window.isRequestInFlight) {
    addMessage("assistant", "Previous request is still running. Please wait a few seconds.");
    return;
  }

  const input = document.getElementById("bgt-input");
  const generateTestsCheckbox = document.getElementById("bgt-generate-tests");
  const settingLlm = document.getElementById("bgt-setting-llm");
  const settingFormat = document.getElementById("bgt-setting-format");
  const settingLang = document.getElementById("bgt-setting-lang");
  const settingRules = document.getElementById("bgt-setting-rules");

  if (!input) return;

  const userPrompt = input.value.trim();

  if (!userPrompt) {
    addMessage("assistant", "Write prompt first.");
    return;
  }

  const isTestPrompt = /(?:^|\n).*?(test|тест)\s*\d+/iu.test(userPrompt);
  const displayPrompt = userPrompt;

  console.log("[DEBUG] Prompt first 100 chars:", userPrompt.substring(0, 100));
  console.log("[DEBUG] Is test prompt:", isTestPrompt);
  console.log("[DEBUG] Has selected elements:", window.selectedElements.length);

  const forcedTestGeneration = Boolean(generateTestsCheckbox?.checked);
  const shouldGenerateTests = forcedTestGeneration;

  setTestModeHint(shouldGenerateTests, "manual");

  if (shouldGenerateTests && !window.selectedElements.length) {
    addMessage("assistant", "Select an element first with Shift + Click before generating test cases.");
    return;
  }

  addMessage("user", displayPrompt);
  pushHistory("user", userPrompt);
  const preferenceProfile = learnFromPrompt(userPrompt);
  input.value = "";

  window.isRequestInFlight = true;
  setRequestUiLocked(true);

  const primarySelection = window.selectedElements[window.selectedElements.length - 1] || window.selectedElementData;
  const normalizedSelectedElements = normalizeSelectionList(window.selectedElements);
  const selectedScreenshotPayloads = window.selectedScreenshots
    .filter((item) => item.selected !== false)
    .map((item) => item.dataUrl);
  const normalizedSelectedScreenshots = await normalizeScreenshotList(selectedScreenshotPayloads, selectedScreenshotPayloads.length || 1);
  const pageUrl = primarySelection?.url || window.location.href;
  const pageTitle = primarySelection?.pageTitle || document.title;
  const selectedText = primarySelection?.text || "";
  const elementLabel = primarySelection?.text || primarySelection?.ariaLabel || primarySelection?.placeholder || "";
  const ariaLabel = primarySelection?.ariaLabel || "";
  const placeholder = primarySelection?.placeholder || "";
  const elementTag = primarySelection?.tag || "";

  const preferredLlm = settingLlm?.value || "default";
  const format = settingFormat?.value || "steps";
  const language = settingLang?.value || "default";
  const customInstructions = settingRules?.value || "";

  // Retrieve stored session preconditions and inject them if new ones are not explicitly written in the prompt
  let finalCustomInstructions = customInstructions;
  const lastPreconditions = localStorage.getItem("bgt-last-preconditions") || "";
  const hasCurrentPreconditions = /(?:preconditions|передумови|передумова|precondition)\s*:/iu.test(userPrompt);
  if (!hasCurrentPreconditions && lastPreconditions) {
    finalCustomInstructions = `Preconditions:\n${lastPreconditions}\n\n${customInstructions}`.trim();
  }

  const payload = {
    userPrompt,
    html: primarySelection?.outerHTML || "",
    url: pageUrl,
    pageTitle,
    selectedText,
    elementLabel,
    ariaLabel,
    placeholder,
    elementTag,
    selectedElements: normalizedSelectedElements,
    recordedActions: window.recordedActions || [],
    images: normalizedSelectedScreenshots.slice(0, MAX_SELECTED_SCREENSHOTS),
    conversationHistory: window.conversationHistory,
    generatedTestCases: window.renderedTestCases || [],
    preferenceProfile,
    preferredLlm,
    format,
    language,
    customInstructions: finalCustomInstructions,
  };

  const pendingMessage = addMessage("assistant", "Thinking...");
  console.log("Payload ready:", payload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes
  
  let elapsedSeconds = 0;
  const updateInterval = setInterval(() => {
    elapsedSeconds++;
    const msg = elapsedSeconds > 15 ? `processing (${elapsedSeconds}s) - waiting for LLM...` : `processing (${elapsedSeconds}s)`;
    setStatus(msg, "#b45309");
  }, 1000);

  try {
    setStatus("sending request", "#b45309");

    const endpoint = "http://localhost:3000/api/chat";

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "MAKE_BACKEND_REQUEST",
          endpoint,
          method: "POST",
          payload,
        },
        (res) => resolve(res)
      );
    });

    if (!response) {
      throw new Error("No response from background script");
    }

    if (!response.ok) {
      const serverError = response.data?.message || response.data?.error || response.error || `HTTP ${response.status}`;
      throw new Error(serverError);
    }

    const result = response.data;

    console.log("Server response:", result);
    setStatus("assistant replied", "#15803d");

    const replyText = result?.reply || (result?.testCases && result.testCases.length ? `Generated ${result.testCases.length} test case(s).` : "No response text.");
    pendingMessage.textContent = replyText;

    if (result.testCases && Array.isArray(result.testCases) && result.testCases.length > 0) {
      const summaryText = result.testCases.map((tc, idx) => {
        const tUA = tc.title?.ua || "";
        const tEN = tc.title?.en || "";
        const title = tUA && tEN ? `${tUA} / ${tEN}` : (tUA || tEN || `Test ${idx + 1}`);
        const preUA = (tc.preconditions?.ua || []).join("; ");
        const preEN = (tc.preconditions?.en || []).join("; ");
        const preStr = preUA || preEN ? ` (Preconditions: ${preUA || preEN})` : "";
        const stepsStr = (tc.steps || []).map((s, si) => {
          const act = s.step?.ua || s.step?.en || "";
          const expUA = (s.expectedResults?.ua || []).join("; ");
          const expEN = (s.expectedResults?.en || []).join("; ");
          const exp = expUA || expEN;
          return `Step ${si + 1}: ${act}${exp ? ` -> Expected: ${exp}` : ""}`;
        }).join("\n  ");
        return `Test #${idx + 1}: ${title}${preStr}\n  ${stepsStr}`;
      }).join("\n\n");

      pushHistory("assistant", `${replyText}\n\nGenerated test case(s):\n${summaryText}`);
      renderTestCases(result.testCases);

      if (result?.debug) {
        console.log("[DEBUG] Delivery result:", result.debug);
      }

      window.nextInlineTestNumber = 1;
      updateAddTestButtonLabel();

      window.selectedScreenshots = [];
      window.selectedElements = [];
      window.recordedActions = [];
      renderSelectedScreenshotsSummary();
      renderSelectedElementsSummary();
      
      saveSessionState();
      
      try {
        chrome.tabs.query({}, (tabs) => {
          (tabs || []).forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" }).catch(() => {});
            }
          });
        });
      } catch (e) {
        console.warn(e);
      }
    } else {
      pushHistory("assistant", replyText);
    }
  } catch (error) {
    console.error("Failed to send payload:", error);
    
    let errorMsg = error.message;
    if (error.name === "AbortError") {
      errorMsg = "Request timeout (3 minutes exceeded) - LLM is taking too long or API is overloaded";
    }
    
    setStatus("chat failed", "#b91c1c");
    pendingMessage.textContent = `❌ Failed to get reply: ${errorMsg}`;
    pendingMessage.style.background = "#fee2e2";
  } finally {
    clearTimeout(timeoutId);
    clearInterval(updateInterval);

    window.isRequestInFlight = false;
    setRequestUiLocked(false);
  }
}
