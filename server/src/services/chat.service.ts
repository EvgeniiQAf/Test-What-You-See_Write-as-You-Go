import { LlmFactory } from "./llm/llm.factory";
import { buildLlmMultimodalContent } from "./llm/llm.helper";
import { LlmMessage } from "./llm/llm.types";
import { LLM_PROMPTS } from "../prompts/llm.prompts";
import { ChatInput } from "../validations/generate.validation";
import { LlmParserService } from "./llm-parser.service";
import { TestCase } from "../types/generate.types";

export class ChatService {
  private llmParser = new LlmParserService();

  public async chatWithAssistant(input: ChatInput): Promise<{ reply?: string; testCases?: TestCase[] }> {
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

    const generatedTestCasesContext = (input.generatedTestCases || [])
      .map((tc: any, idx: number) => {
        const titleUa = tc.title?.ua || "";
        const titleEn = tc.title?.en || "";
        const preUa = (tc.preconditions?.ua || []).join("; ");
        const preEn = (tc.preconditions?.en || []).join("; ");
        const steps = (tc.steps || [])
          .map((s: any, sIdx: number) => {
            const stepUa = s.step?.ua || "";
            const stepEn = s.step?.en || "";
            const expUa = (s.expectedResults?.ua || []).join("; ");
            const expEn = (s.expectedResults?.en || []).join("; ");
            return `  Step ${sIdx + 1}:
    Action (UA): ${stepUa}
    Action (EN): ${stepEn}
    Expected (UA): ${expUa}
    Expected (EN): ${expEn}`;
          })
          .join("\n");

        return `Test #${idx + 1}:
  Title (UA): ${titleUa}
  Title (EN): ${titleEn}
  Preconditions (UA): ${preUa}
  Preconditions (EN): ${preEn}
${steps}`;
      })
      .join("\n\n");

    const rawHtml = String(input.html || "N/A").trim();
    const htmlContent = rawHtml.length > 3500 ? rawHtml.slice(0, 3500) + "... (truncated)" : rawHtml;
    const selectedTextContent = String(input.selectedText || "N/A").trim();
    const truncatedSelectedText = selectedTextContent.length > 1000 ? selectedTextContent.slice(0, 1000) + "... (truncated)" : selectedTextContent;

    const contextLines = [
      `pageTitle: ${normalizedPageTitle || "N/A"}`,
      `selectedText: ${truncatedSelectedText || "N/A"}`,
      `elementLabel: ${input.elementLabel || "N/A"}`,
      `ariaLabel: ${input.ariaLabel || "N/A"}`,
      `placeholder: ${input.placeholder || "N/A"}`,
      `elementTag: ${input.elementTag || "N/A"}`,
      `html: ${htmlContent || "N/A"}`,
      `url: ${input.url || "N/A"}`,
      `recordedActions:\n${recordedActionsContext || "N/A"}`,
      `generatedTestCases:\n${generatedTestCasesContext || "N/A"}`
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
      ...history.slice(-6).map((item): LlmMessage => {
        const content = String(item.content || "").trim();
        const truncated = content.length > 1200 ? content.slice(0, 1200) + "... (truncated)" : content;
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

    const parseReplyResult = (rawContent: string) => {
      const trimmed = String(rawContent || "").trim();
      if (trimmed.includes('"testCases"') || trimmed.includes("testCases")) {
        try {
          const parsed = this.llmParser.parseOpenAiResponse(trimmed) as any;
          if (Array.isArray(parsed?.testCases) && parsed.testCases.length > 0) {
            const normalized = this.llmParser.normalizeTestCasesFromOpenAi(parsed.testCases, input as any);
            return {
              reply: parsed.reply || `Згенеровано ${normalized.length} тест-кейс(ів):`,
              testCases: normalized,
            };
          }
        } catch (jsonErr) {
          console.warn("[CHAT SERVICE] Response hinted at testCases JSON but failed parsing:", jsonErr);
        }
      }
      return { reply: trimmed };
    };

    try {
      const rawReply = await provider.chatCompletion(messages, {
        temperature: 0.3,
      });

      return parseReplyResult(rawReply);
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

        return parseReplyResult(fallbackReply);
      }

      throw error;
    }
  }
}
