import dotenv from "dotenv";

dotenv.config({ override: true });

export const env = {
  port: Number(process.env.PORT) || 3000,

  openAiApiKey: process.env.OPENAI_API_KEY || "",

  testmoToken: process.env.TESTMO_TOKEN || "",
  testmoUrl: process.env.TESTMO_URL || "",
  testmoProjectId: process.env.TESTMO_PROJECT_ID || "",
  testmoFolderId: process.env.TESTMO_FOLDER_ID || "",
};