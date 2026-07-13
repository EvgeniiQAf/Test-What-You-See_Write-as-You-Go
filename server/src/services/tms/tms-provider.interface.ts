import { StandardTestCase } from "./tms.types";

export interface TmsProvider {
  getTmsName(): string;
  getSuiteIdentifier(): string | number;
  createTestCase(testCase: StandardTestCase): Promise<{ success: boolean; createdId: string | number; folderId: string | number }>;
}
