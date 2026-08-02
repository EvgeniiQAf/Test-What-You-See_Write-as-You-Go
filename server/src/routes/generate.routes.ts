import { Router } from "express";
import { GenerateController } from "../controllers/generate.controller";
import { ChatController } from "../controllers/chat.controller";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  createTestCaseSchema,
  createTestmoCaseSchema,
  generateTestCasesSchema,
} from "../validations/generate.validation";

export class GenerateRoutes {
  public router: Router;

  constructor(
    private generateController: GenerateController,
    private chatController: ChatController,
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post(
      "/generate-testcases",
      validate(generateTestCasesSchema),
      asyncHandler(this.generateController.generateTestCases),
    );
    this.router.post(
      "/create-testmo-case",
      validate(createTestmoCaseSchema),
      asyncHandler(this.generateController.createTestmoCase),
    );
    this.router.post(
      "/create-testcase",
      validate(createTestCaseSchema),
      asyncHandler(this.generateController.createTestCase),
    );
    this.router.post(
      "/chat",
      asyncHandler(this.chatController.chatWithAssistant),
    );
    this.router.post(
      "/transcribe",
      asyncHandler(this.chatController.transcribeAudio),
    );
  }
}