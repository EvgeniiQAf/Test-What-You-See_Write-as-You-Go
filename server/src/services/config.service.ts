import { env } from "../config/env";

export class ConfigService {
  public get port(): number {
    return env.port;
  }

  public get openAiApiKey(): string {
    return env.openAiApiKey;
  }

  public get openaiModel(): string {
    return env.openaiModel;
  }

  public get activeLlm(): string {
    return env.activeLlm;
  }

  public get anthropicApiKey(): string {
    return env.anthropicApiKey;
  }

  public get anthropicUrl(): string {
    return env.anthropicUrl;
  }

  public get anthropicModel(): string {
    return env.anthropicModel;
  }

  public get testmoToken(): string {
    return env.testmoToken;
  }

  public get testmoUrl(): string {
    return env.testmoUrl;
  }

  public get testmoProjectId(): string {
    return env.testmoProjectId;
  }

  public get testmoFolderId(): string | number {
    return env.testmoFolderId;
  }

  public get testmoTemplate(): string {
    return env.testmoTemplate;
  }

  public get activeTms(): string {
    return env.activeTms;
  }

  public get testomatApiKey(): string {
    return env.testomatApiKey;
  }

  public get testomatUrl(): string {
    return env.testomatUrl;
  }

  public get testomatSuiteId(): string {
    return env.testomatSuiteId;
  }

  public get testomatTemplate(): string {
    return env.testomatTemplate;
  }
}
