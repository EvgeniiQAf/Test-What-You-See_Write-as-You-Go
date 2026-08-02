document.addEventListener("DOMContentLoaded", () => {
  const requestBtn = document.getElementById("request-btn");

  function promptMicPermission() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        window.close();
      })
      .catch((err) => {
        console.error("Microphone permission error:", err);
      });
  }

  // Trigger Chrome native permission prompt automatically when permission page opens
  promptMicPermission();

  if (requestBtn) {
    requestBtn.addEventListener("click", promptMicPermission);
  }
});
