import { z } from "zod";

export const generateTestCasesSchema = z.object({
  html: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  pageTitle: z.string().nullable().optional(),
  selectedText: z.string().nullable().optional(),
  elementLabel: z.string().nullable().optional(),
  ariaLabel: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  elementTag: z.string().nullable().optional(),
  selectedElements: z
    .array(
      z.object({
        tag: z.string().nullable().optional(),
        text: z.string().nullable().optional(),
        ariaLabel: z.string().nullable().optional(),
        placeholder: z.string().nullable().optional(),
        id: z.string().nullable().optional(),
        className: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        outerHTML: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        pageTitle: z.string().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  images: z.array(z.string().min(1).nullable()).max(10).optional(),
  userPrompt: z.string().nullable().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(20)
    .optional(),
  preferenceProfile: z
    .object({
      preferredLanguage: z.enum(["ua", "en", "ua-en"]).optional(),
      prefersVerifyPrefix: z.boolean().optional(),
      prefersScreenContextPreconditions: z.boolean().optional(),
      expectedNumberingStyle: z.enum(["step-subpoint"]).optional(),
      maxCasesPreference: z.number().int().positive().max(10).optional(),
      notes: z.array(z.string().min(1)).max(20).optional(),
    })
    .optional(),
  preferredLlm: z.enum(["openai", "claude", "default"]).optional(),
  format: z.enum(["steps", "bdd"]).optional(),
  language: z.enum(["default", "ua", "en", "bilingual"]).optional(),
  customInstructions: z.string().optional(),
});

export const chatSchema = z.object({
  userPrompt: z.string().min(1, "userPrompt is required"),
  html: z.string().nullable().optional(),
  pageTitle: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  selectedText: z.string().nullable().optional(),
  elementLabel: z.string().nullable().optional(),
  ariaLabel: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  elementTag: z.string().nullable().optional(),
  selectedElements: z
    .array(
      z.object({
        tag: z.string().nullable().optional(),
        text: z.string().nullable().optional(),
        ariaLabel: z.string().nullable().optional(),
        placeholder: z.string().nullable().optional(),
        id: z.string().nullable().optional(),
        className: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        outerHTML: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        pageTitle: z.string().nullable().optional(),
      }),
    )
    .max(20)
    .optional(),
  images: z.array(z.string().min(1).nullable()).max(10).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(20)
    .optional(),
  preferenceProfile: z
    .object({
      preferredLanguage: z.enum(["ua", "en", "ua-en"]).optional(),
      prefersVerifyPrefix: z.boolean().optional(),
      prefersScreenContextPreconditions: z.boolean().optional(),
      expectedNumberingStyle: z.enum(["step-subpoint"]).optional(),
      maxCasesPreference: z.number().int().positive().max(10).optional(),
      notes: z.array(z.string().min(1)).max(20).optional(),
    })
    .optional(),
  preferredLlm: z.enum(["openai", "claude", "default"]).optional(),
  format: z.enum(["steps", "bdd"]).optional(),
  language: z.enum(["default", "ua", "en", "bilingual"]).optional(),
  customInstructions: z.string().optional(),
});

export const testmoStepSchema = z.object({
  text1: z.string().min(1, "step action is required"),
  text3: z.string().min(1, "step expected result is required"),
});

export const testmoCasePayloadSchema = z.object({
  folder_id: z.number().int().positive(),
  name: z.string().min(1, "name is required"),
  state_id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  custom_priority: z.number().int().positive(),
  custom_description: z.string().min(1, "custom_description is required"),
  custom_steps: z.array(testmoStepSchema).min(1, "at least one step is required"),
});

export const createTestmoCaseSchema = z.object({
  generated_case_id: z.union([z.string(), z.number()]).optional(),
  case: testmoCasePayloadSchema,
});

export const standardTestCaseSchema = z.object({
  title: z.object({
    ua: z.string().min(1, "Ukrainian title is required"),
    en: z.string().min(1, "English title is required"),
  }),
  preconditions: z.object({
    ua: z.array(z.string()),
    en: z.array(z.string()),
  }),
  steps: z.array(
    z.object({
      step: z.object({
        ua: z.string().min(1, "step action in UA is required"),
        en: z.string().min(1, "step action in EN is required"),
      }),
      expectedResults: z.object({
        ua: z.array(z.string()),
        en: z.array(z.string()),
      }),
    })
  ).min(1, "at least one step is required"),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const createTestCaseSchema = z.object({
  generated_case_id: z.union([z.string(), z.number()]).optional(),
  case: standardTestCaseSchema,
});

export type GenerateTestCasesInput = z.infer<typeof generateTestCasesSchema>;
export type CreateTestmoCaseInput = z.infer<typeof createTestmoCaseSchema>;
export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
export type ChatInput = z.infer<typeof chatSchema>;