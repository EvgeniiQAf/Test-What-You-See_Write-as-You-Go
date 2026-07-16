import axios from "axios";
import { env } from "./config/env";

const run = async () => {
  const apiKey = env.testomatApiKey;
  if (!apiKey) {
    console.error("Missing TESTOMAT_API_KEY");
    return;
  }

  // We can try a few endpoint patterns to list suites in the project
  const urlPatterns = [
    `${env.testomatUrl}/api/test_data?api_key=${apiKey}`,
  ];

  for (const url of urlPatterns) {
    try {
      console.log(`Trying GET ${url}`);
      const response = await axios.get(url);
      console.log(`Success! Response status: ${response.status}`);
      console.log("Data:", JSON.stringify(response.data, null, 2));
      return;
    } catch (error: any) {
      console.error(`Failed: ${error.message}`);
      if (error.response?.data) {
        console.error("Error data:", error.response.data);
      }
    }
  }
};

run();
