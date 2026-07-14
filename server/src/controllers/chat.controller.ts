import { Request, Response } from "express";
import { LlmFactory } from "../services/llm/llm.factory";
import { buildLlmMultimodalContent } from "../services/llm/llm.helper";
import { LlmMessage } from "../services/llm/llm.types";
import { chatSchema } from "../validations/generate.validation";

export const chatWithAssistant = async (
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

  const input = validationResult.data;
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
      content: [
        "Ти корисний QA-асистент, який відповідає природно та використовує наданий UI-контекст.",
        "Відповідай українською мовою.",
        "Відповідай прямо на запит користувача.",
        "Якщо запит неясний, неповний або суперечливий, задай одне коротке уточнювальне питання замість здогадок.",
        "Не вигадуй бізнес-логіку, UI-labels або поведінку, якої немає в контексті.",
        "Якщо користувач питає про вибраний елемент, використовуй selected text, label, placeholder, aria-label, tag і HTML як доказ.",
        "Якщо прикріплені скріншоти, аналізуй їх напряму та використовуй видимі UI-елементи з фото як додатковий доказ.",
        "Не кажи, що не можеш аналізувати фото, якщо скріншоти вже прикріплені; у такому випадку дай короткий зміст побаченого на зображенні.",
        "Treat selected element text as a UI label only when it is a static control label, column title, or header. If it looks like a dynamic record value, person name, or item name, use it as context only and do not quote it as the label.",
        "Відповідь має бути короткою, практичною та людяною.",
      ].join(" "),
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

    const trimmedReply = reply.trim();
    if (!trimmedReply) {
      res.status(502).json({ error: "Assistant returned empty response" });
      return;
    }

    res.json({ reply: trimmedReply });
  } catch (error) {
    if (images.length > 0) {
      console.warn("[CHAT] Image input rejected, retrying without images.");
      const fallbackReply = await provider.chatCompletion([
        ...messages.slice(0, -1),
        {
          role: "user",
          content: `${contextLines}\n\nUser question: ${input.userPrompt}`,
        },
      ], {
        temperature: 0.3,
      });

      const trimmedFallback = fallbackReply.trim();

      if (!trimmedFallback) {
        res.status(502).json({ error: "Assistant returned empty response" });
        return;
      }

      res.json({ reply: trimmedFallback });
      return;
    }

    throw error;
  }
};
