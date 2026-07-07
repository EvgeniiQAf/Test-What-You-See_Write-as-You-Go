import { Router } from "express";
import { createDraft } from "../controllers/draft.controller";

const router = Router();

router.post("/", createDraft);

export default router;
