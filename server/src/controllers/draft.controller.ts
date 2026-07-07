import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import {
  TestmoCasePayload,
  createTestmoCase,
} from "../services/testmo-case.service";

export const createDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = req.body as { case: TestmoCasePayload };

  if (!draft.case || !draft.case.name) {
    return res.status(400).json({ message: "Invalid draft payload: missing `case` or `case.name`" });
  }

  const result = await createTestmoCase(draft.case);

  res.status(201).json(result);
});
