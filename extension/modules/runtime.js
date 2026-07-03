export function sendRuntimeMessage(payload) {
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

export async function getNextDraftSequence() {
  const response = await sendRuntimeMessage({ type: "GET_NEXT_DRAFT_SEQUENCE" });
  if (response.error) {
    throw new Error(response.error);
  }
  return Number(response.sequence || 0);
}

export async function saveDraftJsonFile(fileName, draftData) {
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
