import { env } from "../../config/env";
import { TmsProvider } from "./tms-provider.interface";
import { TestmoProvider } from "./testmo.provider";
import { TestomatProvider } from "./testomat.provider";

export class TmsFactory {
  static getProvider(): TmsProvider {
    const tms = env.activeTms;
    console.log(`[TMS FACTORY] Initializing provider for active TMS: ${tms}`);
    
    switch (tms) {
      case "testomat":
        return new TestomatProvider();
      case "testmo":
      default:
        return new TestmoProvider();
    }
  }
}
