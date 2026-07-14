import axios from "axios";
import { LlmFactory } from "../services/llm/llm.factory";
import { OpenaiProvider } from "../services/llm/openai.provider";
import { ClaudeProvider } from "../services/llm/claude.provider";
import { env } from "../config/env";
import { LlmMessage } from "../services/llm/llm.types";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock openai config client
jest.mock("../config/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "Mocked OpenAI reply" } }],
        }),
      },
    },
  },
}));

import { openai } from "../config/openai";

describe("LLM Providers Layer", () => {
  const originalEnv = { ...env };

  afterEach(() => {
    jest.clearAllMocks();
    Object.assign(env, originalEnv);
  });

  describe("LlmFactory", () => {
    it("should return OpenaiProvider by default or when activeLlm is 'openai'", () => {
      env.activeLlm = "openai";
      const provider = LlmFactory.getProvider();
      expect(provider).toBeInstanceOf(OpenaiProvider);
      expect(provider.getLlmName()).toBe("openai");
    });

    it("should return ClaudeProvider when activeLlm is 'claude' or 'anthropic'", () => {
      env.activeLlm = "claude";
      const provider1 = LlmFactory.getProvider();
      expect(provider1).toBeInstanceOf(ClaudeProvider);
      expect(provider1.getLlmName()).toBe("claude");

      env.activeLlm = "anthropic";
      const provider2 = LlmFactory.getProvider();
      expect(provider2).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe("OpenaiProvider", () => {
    it("should correctly call openai chat completions and format standard messages", async () => {
      const provider = new OpenaiProvider();
      const messages: LlmMessage[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User prompt" },
      ];

      const reply = await provider.chatCompletion(messages, { temperature: 0.5 });

      expect(reply).toBe("Mocked OpenAI reply");
      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: env.openaiModel,
          temperature: 0.5,
          messages: [
            { role: "system", content: "System prompt" },
            { role: "user", content: "User prompt" },
          ],
        })
      );
    });

    it("should support multimodal array formatting for OpenAI", async () => {
      const provider = new OpenaiProvider();
      const messages: LlmMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image", image: { mimeType: "image/png", base64: "dGVzdA==" } },
          ],
        },
      ];

      await provider.chatCompletion(messages);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What is this?" },
                { type: "image_url", image_url: { url: "data:image/png;base64,dGVzdA==" } },
              ],
            },
          ],
        })
      );
    });
  });

  describe("ClaudeProvider", () => {
    it("should correctly post to Anthropic API endpoint, moving system prompts to the system parameter", async () => {
      env.anthropicApiKey = "mock-anthropic-key";
      mockedAxios.post.mockResolvedValueOnce({
        data: { content: [{ text: "Mocked Claude reply" }] },
      });

      const provider = new ClaudeProvider();
      const messages: LlmMessage[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User question" },
      ];

      const reply = await provider.chatCompletion(messages);

      expect(reply).toBe("Mocked Claude reply");
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          model: env.anthropicModel,
          system: "System prompt",
          messages: [{ role: "user", content: "User question" }],
        }),
        expect.objectContaining({
          headers: {
            "x-api-key": "mock-anthropic-key",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
        })
      );
    });

    it("should consolidate consecutive user messages for Claude", async () => {
      env.anthropicApiKey = "mock-anthropic-key";
      mockedAxios.post.mockResolvedValueOnce({
        data: { content: [{ text: "Mocked Claude reply" }] },
      });

      const provider = new ClaudeProvider();
      const messages: LlmMessage[] = [
        { role: "user", content: "Question 1" },
        { role: "user", content: "Question 2" },
      ];

      await provider.chatCompletion(messages);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: [{ role: "user", content: "Question 1\n\nQuestion 2" }],
        }),
        expect.any(Object)
      );
    });
  });
});
