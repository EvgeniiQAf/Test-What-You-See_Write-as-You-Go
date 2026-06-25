import axios from "axios";

import { env } from "../config/env";

export const testmoClient = axios.create({
  baseURL: `${env.testmoUrl}/api/v1`,
  headers: {
    Authorization: `Bearer ${env.testmoToken}`,
    "Content-Type": "application/json",
  },
});