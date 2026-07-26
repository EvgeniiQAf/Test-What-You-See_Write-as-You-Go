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
    const recordedActionsContext = (input.recordedActions || [])
      .map((action, idx) => {
        const timeStr = action.timestamp ? `[+${Math.round((action.timestamp - (input.recordedActions?.[0]?.timestamp || 0)) / 1000)}s]` : "";
        if (action.type === "click") {
          return `${idx + 1}. Click ${action.tag} "${action.label || ""}" (id: ${action.id || "N/A"}) at ${action.url || "N/A"} ${timeStr}`;
        } else if (action.type === "input") {
          return `${idx + 1}. Type in ${action.tag} "${action.label || ""}" value: "${action.value || ""}" at ${action.url || "N/A"} ${timeStr}`;
        }
        return `${idx + 1}. Action: ${action.type} on ${action.tag} "${action.label || ""}" at ${action.url || "N/A"} ${timeStr}`;
      })
      .join("\n");

    const contextLines = [
      `pageTitle: ${normalizedPageTitle || "N/A"}`,
      `selectedText: ${input.selectedText || "N/A"}`,
      `elementLabel: ${input.elementLabel || "N/A"}`,
      `ariaLabel: ${input.ariaLabel || "N/A"}`,
      `placeholder: ${input.placeholder || "N/A"}`,
      `elementTag: ${input.elementTag || "N/A"}`,
      `html: ${input.html || "N/A"}`,
      `url: ${input.url || "N/A"}`,
      `recordedActions:\n${recordedActionsContext || "N/A"}`
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
      ...history.slice(-10).map((item): LlmMessage => {
        const content = String(item.content || "").trim();
        const truncated = content.length > 500 ? content.slice(0, 500) + "... (truncated)" : content;
        return {
          role: item.role as "user" | "assistant",
          content: truncated,
        };
      }),
      {
        role: "user",
        content: userMessageContent,
      },
    ];

    if (input.customInstructions) {
      messages.splice(1, 0, {
        role: "system",
        content: `Additional custom user instructions and rules: ${input.customInstructions}`,
      });
    }

    const provider = LlmFactory.getProvider(input.preferredLlm);

    try {
      const reply = await provider.chatCompletion(messages, {
        temperature: 0.3,
      });

      return reply.trim();
    } catch (error) {
      if (images.length > 0) {
        console.warn("[CHAT SERVICE] Image input rejected, retrying without images.");
        const fallbackReply = await provider.chatCompletion([
          ...messages.filter(msg => {
            if (msg.role === "user" && typeof msg.content !== "string") {
              return false; // exclude multimodal user content
            }
            return true;
          }),
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
