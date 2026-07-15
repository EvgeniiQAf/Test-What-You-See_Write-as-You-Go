import { TmsFactory } from "./tms/tms.factory";
import { StandardTestCase } from "./tms/tms.types";

export class TmsService {
  public async createTestCase(testCase: StandardTestCase): Promise<{ success: boolean; createdId: string | number; folderId: string | number }> {
    const provider = TmsFactory.getProvider();
    return await provider.createTestCase(testCase);
  }
}
