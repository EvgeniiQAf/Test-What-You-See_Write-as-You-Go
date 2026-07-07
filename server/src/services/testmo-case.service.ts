import { env } from "../config/env";
import { testmoClient } from "./testmo.service";

interface TestmoStep {
  text1: string;
  text3: string;
}

export interface TestmoCasePayload {
  folder_id: number;
  name: string;
  state_id: number;
  template_id: number;
  custom_priority: number;
  custom_description: string;
  custom_steps: TestmoStep[];
}

export const createTestmoCase = async (payload: TestmoCasePayload) => {
  const projectId = Number(env.testmoProjectId || "1");

  try {
    console.log("Creating Testmo case...");
    console.log(`Case name: ${payload.name}`);
    console.log(`Folder id: ${payload.folder_id}`);
    console.log(`Steps: ${payload.custom_steps?.length || 0}`);

    const response = await testmoClient.post(`/projects/${projectId}/cases`, {
      cases: [payload],
    });

    console.log("Status:", response.status);
    console.log("Created case response:");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error("Failed to create case.");

    if (error?.response?.data) {
      console.error("Testmo error response:");
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error?.message || String(error));
    }
    throw error;
  }
};
