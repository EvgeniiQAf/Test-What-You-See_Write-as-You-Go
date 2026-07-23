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

  const payload = shouldGenerateTests
    ? {
      html: primarySelection?.outerHTML || "",
      url: pageUrl,
      pageTitle,
      selectedText,
      elementLabel,
      ariaLabel,
      placeholder,
      elementTag,
      selectedElements: normalizedSelectedElements,
      images: normalizedSelectedScreenshots.slice(0, MAX_SELECTED_SCREENSHOTS),
      userPrompt,
      conversationHistory: window.conversationHistory,
      preferenceProfile,
      preferredLlm,
      format,
      language,
      customInstructions,
    }
    : {
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
      images: normalizedSelectedScreenshots.slice(0, MAX_SELECTED_SCREENSHOTS),
      conversationHistory: window.conversationHistory,
      preferenceProfile,
      preferredLlm,
      format,
      language,
      customInstructions,
    };

  const pendingMessage = addMessage("assistant", shouldGenerateTests ? "Generating test case(s)..." : "Thinking...");
  console.log("Payload ready:", payload);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes
  
  let elapsedSeconds = 0;
  const updateInterval = setInterval(() => {
    elapsedSeconds++;
    const msg = elapsedSeconds > 15 ? `generating (${elapsedSeconds}s) - waiting for LLM...` : `generating (${elapsedSeconds}s)`;
    setStatus(msg, "#b45309");
  }, 1000);

  try {
    setStatus("sending request", "#b45309");

    const endpoint = shouldGenerateTests
      ? "http://localhost:3000/api/generate-testcases"
      : "http://localhost:3000/api/chat";

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
    setStatus(shouldGenerateTests ? "test case generated" : "assistant replied", "#15803d");

    if (shouldGenerateTests) {
      if (result.reply) {
        pendingMessage.textContent = result.reply;
        pushHistory("assistant", result.reply);
      } else if (result.testCases && Array.isArray(result.testCases)) {
        pendingMessage.textContent = `Generated ${result.testCases.length} test case(s) (took ${elapsedSeconds}s).`;
        pushHistory("assistant", `Generated ${result.testCases.length} test case(s).`);
        renderTestCases(result.testCases);
      } else {
        pendingMessage.textContent = `Server response:\n${JSON.stringify(result, null, 2)}`;
      }

      if (result?.debug) {
        console.log("[DEBUG] Screenshot delivery result:", result.debug);
      }

      window.nextInlineTestNumber = 1;
      updateAddTestButtonLabel();

      window.selectedScreenshots = [];
      renderSelectedScreenshotsSummary();
      console.log("Screenshots cleared after successful response.");

    } else {
      const reply = result?.reply || "No response text.";
      pendingMessage.textContent = reply;
      pushHistory("assistant", reply);
    }
  } catch (error) {
    console.error("Failed to send payload:", error);
    
    let errorMsg = error.message;
    if (error.name === "AbortError") {
      errorMsg = "Request timeout (3 minutes exceeded) - LLM is taking too long or API is overloaded";
    }
    
    setStatus(shouldGenerateTests ? "failed to generate test" : "chat failed", "#b91c1c");
    pendingMessage.textContent = `❌ ${shouldGenerateTests ? "Failed to generate test case" : "Failed to get chat reply"}: ${errorMsg}`;
    pendingMessage.style.background = "#fee2e2";

    if (shouldGenerateTests) {
      window.nextInlineTestNumber = 1;
      updateAddTestButtonLabel();
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(updateInterval);

    window.isRequestInFlight = false;
    setRequestUiLocked(false);
  }
}
