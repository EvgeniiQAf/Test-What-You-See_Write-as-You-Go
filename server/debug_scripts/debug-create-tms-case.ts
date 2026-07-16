import { TmsFactory } from "./services/tms/tms.factory";

const runDebug = async () => {
  console.log("--- Running Debug Universal TMS Test Case Creation ---");

  const testCase = {
    title: {
      ua: "Перевірка входу в кабінет",
      en: "Verify user login to cabinet"
    },
    preconditions: {
      ua: ["Користувач на головній сторінці", "Акаунт активовано"],
      en: ["User is on main page", "Account is active"]
    },
    steps: [
      {
        step: {
          ua: "Ввести логін та пароль",
          en: "Enter login and password"
        },
        expectedResults: {
          ua: ["Поля заповнені коректно"],
          en: ["Fields are filled correctly"]
        }
      },
      {
        step: {
          ua: "Натиснути кнопку 'Увійти'",
          en: "Click 'Login' button"
        },
        expectedResults: {
          ua: ["Користувач бачить головну сторінку кабінету"],
          en: ["User sees main cabinet screen"]
        }
      }
    ],
    priority: "High" as const,
    tags: ["smoke", "regression"]
  };

  try {
    const provider = TmsFactory.getProvider();
    console.log(`Active TMS: ${provider.getTmsName()}`);
    console.log(`Suite ID: ${provider.getSuiteIdentifier()}`);
    
    const result = await provider.createTestCase(testCase);
    console.log("\n--- Debug Universal TMS Creation SUCCESS ---");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n--- Debug Universal TMS Creation FAILED ---", error);
  }
};

runDebug();
