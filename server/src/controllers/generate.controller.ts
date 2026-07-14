import { Request, Response } from "express";
import { env } from "../config/env";
import { TestCaseGeneratorService } from "../services/testcase-generator.service";
import { ClarificationService } from "../services/clarification.service";
import { testmoClient } from "../services/testmo.service";
import { TmsFactory } from "../services/tms/tms.factory";
import { ClarificationResponse, GenerateTestCasesResponse } from "../types/generate.types";
import {
  createTestCaseSchema,
  createTestmoCaseSchema,
  generateTestCasesSchema,
} from "../validations/generate.validation";

export class GenerateController {
  constructor(
    private testCaseGenerator: TestCaseGeneratorService,
    private clarificationService: ClarificationService,
  ) {}

  public generateTestCases = async (
    req: Request,
    res: Response<GenerateTestCasesResponse | ClarificationResponse | { error: string }>,
  ): Promise<void> => {
    console.log("\n[EXTENSION REQUEST] /api/generate-testcases");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Body keys:", Object.keys(req.body));
    console.log("HTML length:", req.body.html?.length || 0, "chars");
    console.log("URL:", req.body.url);
    console.log("Selected text:", req.body.selectedText?.substring(0, 50) || "N/A");

    const validationResult = generateTestCasesSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.log("[VALIDATION ERROR]", validationResult.error.issues);
      res.status(400).json({
        error: validationResult.error.issues[0]?.message || "Invalid request body",
      });
      return;
    }

    console.log("[VALIDATION OK] Calling LLM...");
    const startTime = Date.now();

    try {
      if (this.clarificationService.shouldAskForClarification(validationResult.data)) {
        const reply = await this.clarificationService.generateClarificationReply(validationResult.data);
        const elapsed = Date.now() - startTime;

        console.log(`[CLARIFICATION] Returned reply after ${elapsed}ms`);
        res.json({ reply });
        return;
      }

      const result = await this.testCaseGenerator.generateTestCases(validationResult.data);
      const elapsed = Date.now() - startTime;

      console.log(`[SUCCESS] Generated ${result.testCases.length} test cases (${elapsed}ms)`);
      res.json({
        testCases: result.testCases,
        debug: result.debug,
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[ERROR] Failed after ${elapsed}ms:`, error);
      throw error;
    }
  };

  public createTestmoCase = async (
    req: Request,
    res: Response<{ success: boolean; created?: unknown; folderId?: number; error?: string }>,
  ): Promise<void> => {
    console.log("\n[EXTENSION REQUEST] /api/create-testmo-case");

    const validationResult = createTestmoCaseSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid request body",
      });
      return;
    }

    const projectId = Number(env.testmoProjectId || "1");
    const folderIdFromEnv = Number(String(env.testmoFolderId || "").trim());

    if (!Number.isInteger(folderIdFromEnv) || folderIdFromEnv <= 0) {
      res.status(500).json({
        success: false,
        error: "TESTMO_FOLDER_ID is missing or invalid in .env",
      });
      return;
    }

    const casePayload = {
      ...validationResult.data.case,
      folder_id: folderIdFromEnv,
    };

    const response = await testmoClient.post(`/projects/${projectId}/cases`, {
      cases: [casePayload],
    });

    res.json({
      success: true,
      folderId: folderIdFromEnv,
      created: response.data?.result?.[0] || null,
    });
  };

  public createTestCase = async (
    req: Request,
    res: Response<{ success: boolean; created?: unknown; folderId?: string | number; error?: string }>,
  ): Promise<void> => {
    console.log("\n[EXTENSION REQUEST] /api/create-testcase");

    const validationResult = createTestCaseSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid request body",
      });
      return;
    }

    try {
      const provider = TmsFactory.getProvider();
      const result = await provider.createTestCase(validationResult.data.case);

      res.json({
        success: true,
        folderId: result.folderId,
        created: { id: result.createdId },
      });
    } catch (error: any) {
      console.error("[CREATE CASE ERROR]", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create test case in active TMS",
      });
    }
  };
}