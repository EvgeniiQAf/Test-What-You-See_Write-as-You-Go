import { createTestmoCase, TestmoCasePayload } from "./services/testmo-case.service";

const runDebug = async () => {
  console.log("--- Running Debug Test Case Creation ---");

  const debugPayload: TestmoCasePayload = {
    folder_id: 304, // Hardcoded folder ID for debugging
    name: `[Debug] Test Case Created at ${new Date().toISOString()}`,
    state_id: 5, // Ready for review
    template_id: 2, // Test Case (Text)
    custom_priority: 2, // Medium
    custom_description: "<p>This is a debug test case created directly from the server.</p>",
    custom_steps: [
      {
        text1: "<p>Debug Step 1</p>",
        text3: "<p>Debug Expected Result 1</p>",
      },
    ],
  };

  try {
    console.log("Sending the following payload to createTestmoCase:");
    console.log(JSON.stringify(debugPayload, null, 2));

    const result = await createTestmoCase(debugPayload);

    console.log("\n--- Debug Test Case Creation SUCCESS ---");
    console.log("Testmo API Response:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n--- Debug Test Case Creation FAILED ---");
    // The service already logs the detailed error, so we just log a simple message here.
    console.error("An error occurred during the debug script execution.");
  }
};

runDebug();
