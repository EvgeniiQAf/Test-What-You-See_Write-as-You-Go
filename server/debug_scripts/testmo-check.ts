import { testmoClient } from "./services/testmo.service";

interface TestmoCase {
  id: number;
  name: string;
  folder_id: number | null;
}

const run = async (): Promise<void> => {
  try {
    const response = await testmoClient.get("/projects/1/cases");

    const cases = response.data.result as TestmoCase[];

    const targetFolderIds = [250, 251, 254, 256, 257, 258, 260, 261, 262, 263, 264, 266, 267, 253];

    for (const folderId of targetFolderIds) {
      const folderCases = cases.filter((testCase) => testCase.folder_id === folderId);

      console.log(`\nFolder ID: ${folderId}`);
      console.log(folderCases.map((testCase) => testCase.name));
    }
  } catch (error) {
    console.error(error);
  }
};

run();