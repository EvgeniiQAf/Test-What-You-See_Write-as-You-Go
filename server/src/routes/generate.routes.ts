import { Router } from "express";

import {
	chatWithAssistant,
	createTestmoCase,
	generateTestCases,
} from "../controllers/generate.controller";
import { asyncHandler } from "../middlewares/async-handler.middleware";

const router = Router();

router.post("/generate-testcases", asyncHandler(generateTestCases));
router.post("/create-testmo-case", asyncHandler(createTestmoCase));
router.post("/chat", asyncHandler(chatWithAssistant));

export default router;