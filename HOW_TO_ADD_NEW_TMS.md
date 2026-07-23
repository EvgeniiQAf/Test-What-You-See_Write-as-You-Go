# 🔌 Як додати нову TMS (Test Management System) інтеграцію у TWYS

У цьому посібнику описано, як крок за кроком інтегрувати нову систему керування тестами (наприклад, Jira, TestRail, Azure DevOps чи будь-яку іншу) у бекенд-архітектуру TWYS.

---

## 🛠️ Крок 1: Створіть новий провайдер (Provider)

Всі провайдери TMS лежать у папці `server/src/services/tms/`. Вам потрібно створити новий клас, який імплементує інтерфейс `TmsProvider`.

1. Створіть новий файл, наприклад: `server/src/services/tms/testrail.provider.ts`
2. Напишіть наступний код:

```typescript
import { TmsProvider } from "./tms-provider.interface";
import { StandardTestCase } from "./tms.types";
import { ConfigService } from "../config.service";

export class TestRailProvider implements TmsProvider {
  constructor(private configService: ConfigService) {}

  public getTmsName(): string {
    return "testrail";
  }

  public getSuiteIdentifier(): string | number {
    // Повертає ID сьюта чи папки, де будуть створюватись кейси
    return this.configService.get("TESTRAIL_SUITE_ID") || 1;
  }

  public async createTestCase(testCase: StandardTestCase): Promise<{
    success: boolean;
    createdId: string | number;
    folderId: string | number;
  }> {
    const suiteId = this.getSuiteIdentifier();
    
    // Тут робиться реальний API-запит до вашої TMS
    const url = `${this.configService.get("TESTRAIL_URL")}/api/v2/add_case/${suiteId}`;
    const apiKey = this.configService.get("TESTRAIL_API_KEY");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(\`user:\${apiKey}\`).toString("base64")}`
        },
        body: JSON.stringify({
          title: testCase.title,
          custom_preconds: testCase.preconditions,
          custom_steps: testCase.steps
        })
      });

      if (!response.ok) {
        throw new Error(\`TestRail HTTP \${response.status}\`);
      }

      const result = await response.json();

      return {
        success: true,
        createdId: result.id, // ID створеного тест-кейсу
        folderId: suiteId
      };
    } catch (error: any) {
      console.error("[TESTRAIL ERROR]", error);
      throw new Error(\`TestRail integration failed: \${error.message}\`);
    }
  }
}
```

---

## 🛠️ Крок 2: Зареєструйте провайдер у фабриці (TmsFactory)

Відкрийте файл `server/src/services/tms/tms.factory.ts` та додайте ваш новий провайдер у блок `switch`:

```typescript
import { TestRailProvider } from "./testrail.provider"; // <-- Додати імпорт

// ...
    switch (tms) {
      case "testrail":                                 // <-- Додати кейс
        return new TestRailProvider(this.configService);
      case "testomat":
        return new TestomatProvider(this.configService);
      case "testmo":
      default:
        return new TestmoProvider(this.configService);
    }
```

---

## 🛠️ Крок 3: Налаштуйте конфігурацію середовища (.env)

1. Додайте нові змінні у файл `.env` та `.env.example`:
   ```env
   # Оберіть вашу TMS: "testomat" | "testmo" | "testrail"
   ACTIVE_TMS=testrail

   # Налаштування вашої нової TMS
   TESTRAIL_URL="https://yourcompany.testrail.io"
   TESTRAIL_API_KEY="your_api_key"
   TESTRAIL_SUITE_ID=12
   ```

2. Відкрийте файл `server/src/services/config.service.ts` і додайте опис нових полів (якщо потрібно строге типізування):
   ```typescript
   public get activeTms(): string {
     return this.get("ACTIVE_TMS") || "testmo";
   }
   ```

---

## 🧩 Крок 4: Адаптація на стороні розширення (якщо потрібно)

Якщо ви хочете передавати специфічні додаткові поля чи налаштування безпосередньо з розширення Chrome:
1. Ви можете додати нові змінні у `payload` у файлі розширення `extension/src/backend-client.js`.
2. У файлі `extension/src/ui-templates.js` ви можете кастомізувати інтерфейс передперегляду або селекторів.
