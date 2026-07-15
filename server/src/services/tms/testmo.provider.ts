import { ConfigService } from "../config.service";
import { testmoClient } from "../testmo.service";
import { TmsProvider } from "./tms-provider.interface";
import { StandardTestCase } from "./tms.types";

export class TestmoProvider implements TmsProvider {
  constructor(private configService: ConfigService) {}

  getTmsName(): string {
    return "testmo";
  }

  getSuiteIdentifier(): string | number {
    return Number(this.configService.testmoFolderId || "0");
  }

  async createTestCase(testCase: StandardTestCase): Promise<{ success: boolean; createdId: string | number; folderId: string | number }> {
    const projectId = Number(this.configService.testmoProjectId || "1");
    const folderId = this.getSuiteIdentifier();

    if (!folderId || folderId <= 0) {
      throw new Error("TESTMO_FOLDER_ID is missing or invalid in .env");
    }

    const templateId = this.configService.testmoTemplate === "text" ? 1 : 2; // 2 for steps, 1 for classic/text
    const priority = this.priorityToCustomPriority(testCase.priority || "Medium");

    let payload: any = {
      folder_id: folderId,
      name: testCase.title.en || testCase.title.ua || "Generated Test Case",
      state_id: 5, // active/ready state in Testmo
      template_id: templateId,
      custom_priority: priority,
    };

    if (this.configService.testmoTemplate === "text") {
      payload.custom_description = this.buildTextTemplateHtml(testCase);
    } else {
      payload.custom_description = this.buildPreconditionsHtml(testCase.preconditions.en || testCase.preconditions.ua || []);
      payload.custom_steps = testCase.steps.map((step, stepIndex) => ({
        text1: `<p>${this.escapeHtml(step.step.en || step.step.ua)}</p>`,
        text3: this.buildExpectedHtml(step.expectedResults.en || step.expectedResults.ua || [], stepIndex),
      }));
    }

    console.log(`[TESTMO] Sending payload to project ${projectId}:`, JSON.stringify(payload, null, 2));

    const response = await testmoClient.post(`/projects/${projectId}/cases`, {
      cases: [payload],
    });

    const created = response.data?.result?.[0] || null;
    if (!created) {
      throw new Error("Testmo response did not return a created case");
    }

    return {
      success: true,
      createdId: created.id,
      folderId: folderId,
    };
  }

  private priorityToCustomPriority(priority: string): number {
    if (priority === "High") return 3;
    if (priority === "Low") return 1;
    return 2; // Medium
  }

  private escapeHtml(text: string): string {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private buildPreconditionsHtml(preconditions: string[]): string {
    const lines = (preconditions || [])
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .map((line) => `<p>${this.escapeHtml(line)}</p>`)
      .join("");

    return `<div><strong>Preconditions:</strong>${lines}</div>`;
  }

  private buildExpectedHtml(expectedList: string[], stepIndex: number): string {
    const numbered = (expectedList || []).map((line, expectedIndex) => {
      const normalized = String(line || "")
        .replace(/^\s*\d+(?:\.\d+)?[\)\.]?\s*/u, "")
        .trim();
      return `${stepIndex + 1}.${expectedIndex + 1} ${normalized}`.trim();
    });
    return `<p>${numbered.map((line) => this.escapeHtml(line)).join("<br />")}</p>`;
  }

  private buildTextTemplateHtml(testCase: StandardTestCase): string {
    const preconditions = (testCase.preconditions.en || testCase.preconditions.ua || [])
      .map((line) => `<p>${this.escapeHtml(line)}</p>`)
      .join("");

    const steps = testCase.steps
      .map((step, stepIndex) => {
        const stepText = `<p><strong>Step ${stepIndex + 1}:</strong> ${this.escapeHtml(step.step.en || step.step.ua)}</p>`;
        const expectedText = (step.expectedResults.en || step.expectedResults.ua || [])
          .map((exp, expIndex) => `<p>Expected ${stepIndex + 1}.${expIndex + 1}: ${this.escapeHtml(exp)}</p>`)
          .join("");
        return `${stepText}${expectedText}`;
      })
      .join("<br />");

    return `<div><strong>Preconditions:</strong>${preconditions}</div><br /><div><strong>Steps & Expected Results:</strong>${steps}</div>`;
  }
}
