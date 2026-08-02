import { Request, Response } from "express";
import { ChatService } from "../services/chat.service";
import { TranscribeService } from "../services/transcribe.service";
import { chatSchema } from "../validations/generate.validation";

export class ChatController {
  constructor(
    private chatService: ChatService,
    private transcribeService: TranscribeService = new TranscribeService(),
  ) {}

  public chatWithAssistant = async (
    req: Request,
    res: Response<{ reply?: string; testCases?: any[]; error?: string }>,
  ): Promise<void> => {
    const validationResult = chatSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: validationResult.error.issues[0]?.message || "Invalid request body",
      });
      return;
    }

    try {
      const result = await this.chatService.chatWithAssistant(validationResult.data);
      if (!result || (!result.reply && (!result.testCases || result.testCases.length === 0))) {
        res.status(502).json({ error: "Assistant returned empty response" });
        return;
      }

      res.json(result);
    } catch (error: any) {
      console.error("[CHAT CONTROLLER ERROR]", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  };

  public transcribeAudio = async (
    req: Request,
    res: Response<{ text?: string; error?: string }>,
  ): Promise<void> => {
    const { audio } = req.body || {};
    if (!audio) {
      res.status(400).json({ error: "Audio payload is missing" });
      return;
    }

    try {
      const text = await this.transcribeService.transcribeAudio(audio);
      res.json({ text });
    } catch (error: any) {
      console.error("[TRANSCRIBE CONTROLLER ERROR]", error);
      res.status(500).json({ error: error.message || "Transcription failed" });
    }
  };
}
