export interface LocalizedText {
  ua: string;
  en: string;
}

export interface BilingualStep {
  step: LocalizedText;
  expectedResults: {
    ua: string[];
    en: string[];
  };
}

export interface TestCase {
  title: LocalizedText;
  preconditions: {
    ua: string[];
    en: string[];
  };
  steps: BilingualStep[];
  priority: "Low" | "Medium" | "High";
  tags: string[];
}

export interface GenerateTestCasesRequestBody {
  html?: string;
  url?: string;
  pageTitle?: string;
  selectedText?: string;
  images?: Array<string | null>;
  selectedElements?: Array<{
    tag?: string;
    text?: string;
    ariaLabel?: string;
    placeholder?: string;
    id?: string;
    className?: string | string[];
    outerHTML?: string;
    url?: string;
    pageTitle?: string;
  }>;
  userPrompt?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  preferenceProfile?: {
    preferredLanguage?: "ua" | "en" | "ua-en";
    prefersVerifyPrefix?: boolean;
    prefersScreenContextPreconditions?: boolean;
    expectedNumberingStyle?: "step-subpoint";
    maxCasesPreference?: number;
    notes?: string[];
  };
}

export interface GenerateTestCasesResponse {
  testCases: TestCase[];
  debug?: {
    imagesReceived: number;
    imageMode: "vision" | "text-only";
  };
}

export interface ClarificationResponse {
  reply: string;
}

export interface ChatRequestBody {
  userPrompt: string;
  html?: string;
  pageTitle?: string;
  url?: string;
  selectedText?: string;
  images?: Array<string | null>;
  selectedElements?: Array<{
    tag?: string;
    text?: string;
    ariaLabel?: string;
    placeholder?: string;
    id?: string;
    className?: string | string[];
    outerHTML?: string;
    url?: string;
    pageTitle?: string;
  }>;
  elementLabel?: string;
  ariaLabel?: string;
  placeholder?: string;
  elementTag?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  preferenceProfile?: {
    preferredLanguage?: "ua" | "en" | "ua-en";
    prefersVerifyPrefix?: boolean;
    prefersScreenContextPreconditions?: boolean;
    expectedNumberingStyle?: "step-subpoint";
    maxCasesPreference?: number;
    notes?: string[];
  };
}