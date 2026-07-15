import { ConfigService } from "../config.service";
import { TmsProvider } from "./tms-provider.interface";
import { TestmoProvider } from "./testmo.provider";
import { TestomatProvider } from "./testomat.provider";

export class TmsFactory {
  constructor(private configService: ConfigService) {}

  public getProvider(): TmsProvider {
    const tms = this.configService.activeTms;
    console.log(`[TMS FACTORY] Initializing provider for active TMS: ${tms}`);
    
    switch (tms) {
      case "testomat":
        return new TestomatProvider(this.configService);
      case "testmo":
      default:
        return new TestmoProvider(this.configService);
    }
  }
}
