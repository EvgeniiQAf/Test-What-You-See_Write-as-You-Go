import { LlmFactory } from "./llm/llm.factory";
import { buildLlmMultimodalContent } from "./llm/llm.helper";
import { LlmMessage } from "./llm/llm.types";
import { LLM_PROMPTS } from "../prompts/llm.prompts";
import { ChatInput } from "../validations/generate.validation";

export class ChatService {
  public async chatWithAssistant(input: ChatInput): Promise<string> {
    const history = input.conversationHistory || [];
    const preferenceProfile = input.preferenceProfile || {};
    const images = Array.isArray(input.images)
      ? input.images
          .map((image) => String(image || "").trim())
          .filter((image) => image.startsWith("data:image/") || /^https?:\/\//i.test(image))
      : [];
    const normalizedPageTitle = String(input.pageTitle || "")
      .replace(/\s*[-|]\s*TripLink\s*$/i, "")
      .replace(/^TripLink\s*[-|]\s*/i, "")
      .trim();
    const contextLines = [
      `pageTitle: ${normalizedPageTitle || "N/A"}`,
      `selectedText: ${input.selectedText || "N/A"}`,
      `elementLabel: ${input.elementLabel || "N/A"}`,
      `ariaLabel: ${input.ariaLabel || "N/A"}`,
      `placeholder: ${input.placeholder || "N/A"}`,
      `elementTag: ${input.elementTag || "N/A"}`,
      `html: ${input.html || "N/A"}`,
      `url: ${input.url || "N/A"}`,
    ].join("\n");

    const userMessageContent = images.length > 0
      ? buildLlmMultimodalContent(
          `${contextLines}\n\nUser question: ${input.userPrompt}`,
          images,
        )
      : `${contextLines}\n\nUser question: ${input.userPrompt}`;

    const messages: LlmMessage[] = [
      {
        role: "system",
        content: LLM_PROMPTS.chatSystem,
      },
      {
        role: "system",
        content: `User preferences: ${JSON.stringify(preferenceProfile)}`,
      },
      {
        role: "system",
        content: `Current context:\n${contextLines}`,
      },
      ...history.slice(-10).map((item): LlmMessage => ({
        role: item.role as "user" | "assistant",
        content: item.content,
      })),
      {
        role: "user",
        content: userMessageContent,
      },
    ];

    const provider = LlmFactory.getProvider();

    try {
      const reply = await provider.chatCompletion(messages, {
        temperature: 0.3,
      });

      return reply.trim();
    } catch (error) {
      if (images.length > 0) {
        console.warn("[CHAT SERVICE] Image input rejected, retrying without images.");
        const fallbackReply = await provider.chatCompletion([
          ...messages.slice(0, -1),
          {
            role: "user",
            content: `${contextLines}\n\nUser question: ${input.userPrompt}`,
          },
        ], {
          temperature: 0.3,
        });

        return fallbackReply.trim();
      }

      throw error;
    }
  }
}
