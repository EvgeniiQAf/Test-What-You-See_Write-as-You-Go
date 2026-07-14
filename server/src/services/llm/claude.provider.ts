import axios from "axios";
import { env } from "../../config/env";
import { LlmProvider } from "./llm-provider.interface";
import { LlmCompletionOptions, LlmMessage } from "./llm.types";

export class ClaudeProvider implements LlmProvider {
  getLlmName(): string {
    return "claude";
  }

  async chatCompletion(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<string> {
    const apiKey = env.anthropicApiKey;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing in .env");
    }

    const model = options?.model || env.anthropicModel || "claude-3-5-sonnet-20240620";
    const temperature = options?.temperature !== undefined ? options.temperature : 0.3;

    // Claude requires system prompt in a separate top-level field, not in messages
    const systemMessages = messages.filter((m) => m.role === "system");
    const systemPrompt = systemMessages
      .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text).join("\n")))
      .join("\n\n");

    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    // Format non-system messages
    const formattedMessages = nonSystemMessages.map((msg) => {
      // Role mapping: Claude only accepts 'user' and 'assistant'
      const role = msg.role === "assistant" ? "assistant" : "user";

      if (typeof msg.content === "string") {
        return {
          role,
          content: msg.content,
        };
      }

      // Multimodal array format
      const content = msg.content.map((part) => {
        if (part.type === "text") {
          return {
            type: "text",
            text: part.text || "",
          };
        } else if (part.type === "image" && part.image) {
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: part.image.mimeType,
              data: part.image.base64,
            },
          };
        }
        throw new Error(`Unsupported message part type in Claude: ${part.type}`);
      });

      return {
        role,
        content,
      };
    });

    // Handle consecutive roles if any (Claude rule: alternate user and assistant)
    const consolidatedMessages: any[] = [];
    for (const msg of formattedMessages) {
      if (consolidatedMessages.length > 0 && consolidatedMessages[consolidatedMessages.length - 1].role === msg.role) {
        const lastMsg = consolidatedMessages[consolidatedMessages.length - 1];
        if (typeof lastMsg.content === "string" && typeof msg.content === "string") {
          lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
        } else {
          const lastContentArray = Array.isArray(lastMsg.content) ? lastMsg.content : [{ type: "text", text: lastMsg.content }];
          const currentContentArray = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
          lastMsg.content = [...lastContentArray, ...currentContentArray];
        }
      } else {
        consolidatedMessages.push(msg);
      }
    }

    const payload: any = {
      model,
      max_tokens: 4096,
      temperature,
      messages: consolidatedMessages,
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    // JSON response format instruction (Claude does not have a native response_format json, so we add a system prompt instruction if json is requested)
    if (options?.responseFormat === "json") {
      payload.system = `${payload.system || ""}\n\nCRITICAL: Return ONLY valid JSON output. No markdown wrappers, no conversational preambles.`.trim();
    }

    const url = `${env.anthropicUrl}/messages`;
    console.log(`[CLAUDE PROVIDER] Calling Claude API with model: ${model}, temperature: ${temperature}`);

    const response = await axios.post(url, payload, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    });

    const reply = response.data?.content?.[0]?.text;
    if (!reply) {
      throw new Error("Claude returned an empty response");
    }

    return reply;
  }
}
