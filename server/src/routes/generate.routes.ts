import { Router } from "express";

import {
	chatWithAssistant,
	createTestmoCase,
	generateTestCases,
} from "../controllers/generate.controller";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
	createTestmoCaseSchema,
	generateTestCasesSchema,
} from "../validations/generate.validation";

const router = Router();

router.post(
	"/generate-testcases",
	validate(generateTestCasesSchema),
	asyncHandler(generateTestCases),
);
router.post(
	"/create-testmo-case",
	validate(createTestmoCaseSchema),
	asyncHandler(createTestmoCase),
);
router.post("/chat", asyncHandler(chatWithAssistant));

export default router;