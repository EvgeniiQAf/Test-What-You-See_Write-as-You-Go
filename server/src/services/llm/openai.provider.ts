import { openai } from "../../config/openai";
import { env } from "../../config/env";
import { LlmProvider } from "./llm-provider.interface";
import { LlmCompletionOptions, LlmMessage } from "./llm.types";

export class OpenaiProvider implements LlmProvider {
  getLlmName(): string {
    return "openai";
  }

  async chatCompletion(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<string> {
    const model = options?.model || env.openaiModel || "gpt-4o";
    const temperature = options?.temperature !== undefined ? options.temperature : 0.3;
    const responseFormat = options?.responseFormat === "json" ? { type: "json_object" as const } : { type: "text" as const };

    const formattedMessages = messages.map((msg) => {
      if (typeof msg.content === "string") {
        return {
          role: msg.role,
          content: msg.content,
        };
      }

      // Convert multimodal array
      const content = msg.content.map((part) => {
        if (part.type === "text") {
          return {
            type: "text" as const,
            text: part.text || "",
          };
        } else if (part.type === "image" && part.image) {
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${part.image.mimeType};base64,${part.image.base64}`,
            },
          };
        }
        throw new Error(`Unsupported message part type: ${part.type}`);
      });

      return {
        role: msg.role,
        content,
      };
    });

    console.log(`[OPENAI PROVIDER] Calling OpenAI Chat Completion with model: ${model}, temperature: ${temperature}`);

    const response = await openai.chat.completions.create({
      model,
      temperature,
      response_format: responseFormat,
      messages: formattedMessages as any,
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) {
      throw new Error("OpenAI returned an empty response");
    }

    return reply;
  }
}
