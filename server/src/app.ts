import express from "express";
import cors from "cors";

import { env } from "./config/env";
import { errorMiddleware } from "./middlewares/error.middleware";
import generateRoutes from "./routes/generate.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n[HTTP] ${req.method} ${req.path}`);
  console.log("[CORS] Origin:", req.headers.origin || "none");
  next();
});

app.get("/health", (_req, res) => {
  console.log("[HEALTH CHECK] OK");
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    testmoFolderId: env.testmoFolderId,
  });
});

app.post("/api/extension-test", (req, res) => {
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

app.use("/api", generateRoutes);
app.use(errorMiddleware);

export default app;