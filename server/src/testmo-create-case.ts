import fs from "node:fs/promises";
import path from "node:path";

import { env } from "./config/env";
import { testmoClient } from "./services/testmo.service";

interface TestmoStep {
  text1: string;
  text3: string;
}

interface TestmoCasePayload {
  folder_id: number;
  name: string;
  state_id: number;
  template_id: number;
  custom_priority: number;
  custom_description: string;
  custom_steps: TestmoStep[];
}

interface DraftFile {
  generated_case_id?: string | number;
  case: TestmoCasePayload;
}

const readDraftFromFile = async (draftFilePath: string): Promise<DraftFile> => {
  const absolutePath = path.resolve(process.cwd(), draftFilePath);
  const fileContent = await fs.readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(fileContent) as DraftFile;

  if (!parsed.case || !parsed.case.name) {
    throw new Error("Draft JSON is invalid: missing `case` or `case.name`");
  }

  return parsed;
};

const run = async (): Promise<void> => {
  const draftPath = process.argv[2] || "../testmo-draft-1.json";
  const projectId = Number(env.testmoProjectId || "1");

  try {
    console.log(`Reading draft from: ${draftPath}`);

    const draft = await readDraftFromFile(draftPath);

    console.log("Creating Testmo case from draft...");
    console.log(`Draft id: ${draft.generated_case_id || "n/a"}`);
    console.log(`Case name: ${draft.case.name}`);
    console.log(`Folder id: ${draft.case.folder_id}`);
    console.log(`Steps: ${draft.case.custom_steps?.length || 0}`);

    const response = await testmoClient.post(`/projects/${projectId}/cases`, {
      cases: [draft.case],
    });

    console.log("Status:", response.status);
    console.log("Created case response:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Failed to create case from draft.");

    if (error?.response?.data) {
      console.error("Testmo error response:");
      console.error(JSON.stringify(error.response.data, null, 2));
      return;
    }

    console.error(error?.message || String(error));
  }
};

run();