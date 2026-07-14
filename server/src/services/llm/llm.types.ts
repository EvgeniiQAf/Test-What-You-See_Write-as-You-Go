export interface LlmMessagePart {
  type: "text" | "image";
  text?: string;
  image?: {
    mimeType: string; // e.g., "image/jpeg", "image/png", "image/webp"
    base64: string;   // raw base64 data without data URI prefix
  };
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string | LlmMessagePart[];
}

export interface LlmCompletionOptions {
  model?: string;
  temperature?: number;
  responseFormat?: "json" | "text";
}
