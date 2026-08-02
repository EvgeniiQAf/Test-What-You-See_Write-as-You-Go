import express from "express";
import cors from "cors";

import { env } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import { GenerateRoutes } from "./routes/generate.routes";
import { GenerateController } from "./controllers/generate.controller";
import { ChatController } from "./controllers/chat.controller";
import { TestCaseGeneratorService } from "./services/testcase-generator.service";
import { ClarificationService } from "./services/clarification.service";
import { ChatService } from "./services/chat.service";
import { TmsService } from "./services/tms.service";
import { TmsFactory } from "./services/tms/tms.factory";
import { ConfigService } from "./services/config.service";
import { LlmParserService } from "./services/llm-parser.service";

export class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.configureMiddlewares();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      console.log(`\n[HTTP] ${req.method} ${req.path}`);
      console.log("[CORS] Origin:", req.headers.origin || "none");
      next();
    });
  }

  private configureRoutes(): void {
    this.app.get("/health", (_req, res) => {
      console.log("[HEALTH CHECK] OK");
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    });

    this.app.get("/api/config", (_req, res) => {
      res.json({
        activeTms: env.activeTms,
        testmoFolderId: env.testmoFolderId,
        testomatSuiteId: env.testomatSuiteId,
      });
    });

    this.app.post("/api/extension-test", (req, res) => {
      console.log("Extension data received:");

      console.log({
        element: req.body.element,
        userPrompt: req.body.userPrompt,
        hasScreenshot: Boolean(req.body.screenshot),
        screenshotSize: req.body.screenshot?.length || 0,
      });

      res.json({
        success: true,
        message: "Data received from extension",
        received: {
          hasElement: Boolean(req.body.element),
          hasPrompt: Boolean(req.body.userPrompt),
          hasScreenshot: Boolean(req.body.screenshot),
          screenshotSize: req.body.screenshot?.length || 0,
        },
      });
    });

    // Dependency Injection: Instantiate services, controllers, and routes
    const configService = new ConfigService();
    const llmParserService = new LlmParserService();
    const testCaseGeneratorService = new TestCaseGeneratorService(llmParserService);
    const clarificationService = new ClarificationService();
    const chatService = new ChatService();
    const tmsFactory = new TmsFactory(configService);
    const tmsService = new TmsService(tmsFactory);

    const generateController = new GenerateController(
      testCaseGeneratorService,
      clarificationService,
      tmsService,
    );
    const chatController = new ChatController(chatService);

    const generateRoutes = new GenerateRoutes(generateController, chatController);

    this.app.use("/api", generateRoutes.router);
  }

  private configureErrorHandling(): void {
    this.app.use(errorMiddleware);
  }
}

// Instantiate and export the default express application for backward compatibility
const appInstance = new App();
export default appInstance.app;