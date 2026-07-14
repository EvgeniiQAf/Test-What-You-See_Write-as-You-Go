import dotenv from "dotenv";

dotenv.config({ override: true });

export const env = {
  port: Number(process.env.PORT) || 3000,

  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",

  activeLlm: (process.env.ACTIVE_LLM || "openai").toLowerCase(),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicUrl: process.env.ANTHROPIC_URL || "https://api.anthropic.com/v1",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",

  testmoToken: process.env.TESTMO_TOKEN || "",
  testmoUrl: process.env.TESTMO_URL || "",
  testmoProjectId: process.env.TESTMO_PROJECT_ID || "",
  testmoFolderId: process.env.TESTMO_FOLDER_ID || "",
  testmoTemplate: process.env.TESTMO_TEMPLATE || "steps",

  activeTms: (process.env.ACTIVE_TMS || "testmo").toLowerCase(),

  testomatApiKey: process.env.TESTOMAT_API_KEY || "",
  testomatUrl: process.env.TESTOMAT_URL || "https://app.testomat.io",
  testomatSuiteId: process.env.TESTOMAT_SUITE_ID || "",
  testomatTemplate: process.env.TESTOMAT_TEMPLATE || "steps",
};