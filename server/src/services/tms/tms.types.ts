export interface StandardTestCase {
  title: {
    ua: string;
    en: string;
  };
  preconditions: {
    ua: string[];
    en: string[];
  };
  steps: {
    step: {
      ua: string;
      en: string;
    };
    expectedResults: {
      ua: string[];
      en: string[];
    };
  }[];
  priority?: "Low" | "Medium" | "High";
  tags?: string[];
}
