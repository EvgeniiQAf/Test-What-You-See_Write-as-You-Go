# Інструкція: Додавання нових TMS (Test Management Systems)

Цей проект спроектований за шаблоном "Фабрика" (Factory Pattern) та має інтерфейсний провайдер, що дозволяє легко масштабуватись та додавати будь-яку іншу систему керування тестами (наприклад, Qase, Jira, TestRail тощо).

Ось покрокова інструкція, як додати підтримку нової TMS:

---

## Крок 1: Додайте змінні середовища

1. Відкрийте файл [env.ts](file:///Users/stayinformed/TWYS/Test-What-You-See.-Write-as-You-Go./server/src/config/env.ts) та додайте необхідні конфігураційні змінні для нової TMS (API-ключі, URL, ID проектів).
2. Оновіть файли `.env.example` та локальний `.env` відповідними ключами.

*Приклад для нової TMS (наприклад, Qase):*
```env
# Вкажіть нову TMS як активну
ACTIVE_TMS=qase

# Налаштування Qase
QASE_API_TOKEN=your_token_here
QASE_PROJECT_CODE=PRJ
QASE_SUITE_ID=12
QASE_TEMPLATE=steps
```

---

## Крок 2: Створіть клас провайдера

Створіть новий файл реалізації у директорії `server/src/services/tms/` (наприклад, `qase.provider.ts`). 
Клас повинен імплементувати інтерфейс `TmsProvider`:

```typescript
import axios from "axios";
import { env } from "../../config/env";
import { TmsProvider } from "./tms-provider.interface";
import { StandardTestCase } from "./tms.types";

export class QaseProvider implements TmsProvider {
  getTmsName(): string {
    return "qase";
  }

  getSuiteIdentifier(): string | number {
    return env.qaseSuiteId || "";
  }

  async createTestCase(testCase: StandardTestCase): Promise<{ success: boolean; createdId: string | number; folderId: string | number }> {
    // 1. Форматуйте тест-кейс відповідно до вимог нової TMS та обраного шаблону (steps/text).
    // 2. Виконайте HTTP-запит до API нової TMS для створення кейсу.
    // 3. Поверніть ID створеного кейсу та ID папки/сюїти.
    
    const payload = {
      title: testCase.title.en,
      description: testCase.preconditions.en.join("\n"),
      steps: testCase.steps.map(s => ({ action: s.step.en, expected: s.expectedResults.en.join("\n") }))
    };

    const response = await axios.post("https://api.qase.io/v1/case/...", payload, {
      headers: {
        Token: env.qaseApiToken
      }
    });

    return {
      success: true,
      createdId: response.data.result.id,
      folderId: this.getSuiteIdentifier()
    };
  }
}
```

---

## Крок 3: Зареєструйте новий провайдер у Фабриці

Відкрийте файл [tms.factory.ts](file:///Users/stayinformed/TWYS/Test-What-You-See.-Write-as-You-Go./server/src/services/tms/tms.factory.ts) та додайте імпорт і новий кейс у конструкцію `switch`:

```typescript
import { QaseProvider } from "./qase.provider"; // Новий імпорт

export class TmsFactory {
  static getProvider(): TmsProvider {
    const tms = env.activeTms;
    
    switch (tms) {
      case "qase":
        return new QaseProvider(); // Реєстрація
      case "testomat":
        return new TestomatProvider();
      case "testmo":
      default:
        return new TestmoProvider();
    }
  }
}
```

---

## Крок 4: Перевірка та Тестування

1. Створіть модульний тест у директорії `server/src/__tests__/`, скопіювавши приклад із `create-testcase.test.ts`.
2. Запустіть тести:
   ```bash
   npm run test --prefix server
   ```
