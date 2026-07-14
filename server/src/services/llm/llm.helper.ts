import { LlmMessagePart } from "./llm.types";

export const buildLlmMultimodalContent = (text: string, images: string[]): LlmMessagePart[] => {
  const parts: LlmMessagePart[] = [
    { type: "text", text }
  ];

  for (const img of images) {
    if (img.startsWith("data:image/")) {
      const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      if (match && match[1] && match[2]) {
        parts.push({
          type: "image",
          image: {
            mimeType: match[1],
            base64: match[2],
          }
        });
      }
    }
  }

  return parts;
};
