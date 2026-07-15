import { Request, Response } from "express";
import { ChatService } from "../services/chat.service";
import { chatSchema } from "../validations/generate.validation";

export class ChatController {
  constructor(private chatService: ChatService) {}

  public chatWithAssistant = async (
    req: Request,
    res: Response<{ reply?: string; error?: string }>,
  ): Promise<void> => {
    const validationResult = chatSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: validationResult.error.issues[0]?.message || "Invalid request body",
      });
      return;
    }

    try {
      const reply = await this.chatService.chatWithAssistant(validationResult.data);
      if (!reply) {
        res.status(502).json({ error: "Assistant returned empty response" });
        return;
      }

      res.json({ reply });
    } catch (error: any) {
      console.error("[CHAT CONTROLLER ERROR]", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  };
}
