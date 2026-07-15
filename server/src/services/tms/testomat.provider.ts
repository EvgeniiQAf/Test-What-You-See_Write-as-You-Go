import axios from "axios";
import { ConfigService } from "../config.service";
import { TmsProvider } from "./tms-provider.interface";
import { StandardTestCase } from "./tms.types";

export class TestomatProvider implements TmsProvider {
  constructor(private configService: ConfigService) {}

  getTmsName(): string {
    return "testomat";
  }

  getSuiteIdentifier(): string | number {
    return this.configService.testomatSuiteId || "Sprint 1";
  }

  async createTestCase(testCase: StandardTestCase): Promise<{ success: boolean; createdId: string | number; folderId: string | number }> {
    const apiKey = this.configService.testomatApiKey;
    if (!apiKey) {
      throw new Error("TESTOMAT_API_KEY is missing in .env");
    }

    const suitePath = String(this.getSuiteIdentifier())
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const formattedCode = this.formatTestCaseToMarkdown(testCase);

    const payload = {
      framework: "manual",
      language: "typescript",
      "no-detach": true,
      force: true,
      tests: [
        {
          name: testCase.title.en || testCase.title.ua || "Generated Test Case",
          suites: suitePath,
          code: formattedCode,
        },
      ],
    };

    const url = `${this.configService.testomatUrl}/api/load?api_key=${apiKey}&force=true`;
    console.log(`[TESTOMAT.IO] Posting to ${url} with suite path ${suitePath.join(" > ")}`);
    console.log(`[TESTOMAT.IO] Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("[TESTOMAT.IO] Response status:", response.status);
    console.log("[TESTOMAT.IO] Response data:", JSON.stringify(response.data, null, 2));

    // Fallback created ID
    const createdId = response.data?.tests?.[0]?.id || response.data?.created?.[0]?.id || "imported";

    return {
      success: true,
      createdId: createdId,
      folderId: suitePath.join(" > "),
    };
  }

  private formatTestCaseToMarkdown(testCase: StandardTestCase): string {
    const preconditionsList = testCase.preconditions.en || testCase.preconditions.ua || [];
    const preconditionsMarkdown = preconditionsList.length > 0
      ? `### Preconditions\n${preconditionsList.map((p) => `- ${p}`).join("\n")}\n\n`
      : "";

    if (this.configService.testomatTemplate === "text") {
      // General text template (just description + preconditions)
      return `${preconditionsMarkdown}`;
    }

    // Steps template
    const stepsMarkdown = testCase.steps
      .map((step, stepIndex) => {
        const action = `1. ${step.step.en || step.step.ua}`;
        const expectedList = step.expectedResults.en || step.expectedResults.ua || [];
        const expected = expectedList.length > 0
          ? `\n   * **Expected:** ${expectedList.join(", ")}`
          : "";
        return `${action}${expected}`;
      })
      .join("\n");

    return `${preconditionsMarkdown}### Steps\n${stepsMarkdown}`;
  }
}
