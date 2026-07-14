import request from 'supertest';
import app from '../app';
import * as OpenAIService from '../services/openai.service';

// Мокуємо модуль сервісу OpenAI
jest.mock('../services/openai.service');

describe('POST /api/generate-testcases', () => {
  const mockTestCases = {
    testCases: [{ title: 'Test Case 1', steps: [{ content: 'Step 1' }] }],
    debug: { imagesReceived: 0, imageMode: 'text-only' as const },
  };

  beforeEach(() => {
    // Скидаємо моки перед кожним тестом
    (OpenAIService.generateTestCasesFromElement as jest.Mock).mockClear();
    (OpenAIService.shouldAskForClarification as jest.Mock).mockClear();
  });

  it('should return 200 and test cases on successful generation', async () => {
    // Налаштовуємо моки для успішного сценарію
    (OpenAIService.shouldAskForClarification as jest.Mock).mockReturnValue(false);
    (OpenAIService.generateTestCasesFromElement as jest.Mock).mockResolvedValue(mockTestCases);

    const response = await request(app)
      .post('/api/generate-testcases')
      .send({ html: '<button>Login</button>', url: 'http://localhost/login' });

    // Перевіряємо, що статус відповіді 200
    expect(response.status).toBe(200);
    // Перевіряємо, що тіло відповіді містить очікувані тест-кейси
    expect(response.body).toEqual(mockTestCases);
    // Перевіряємо, що наш сервіс був викликаний
    expect(OpenAIService.generateTestCasesFromElement).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if validation fails', async () => {
    const response = await request(app)
      .post('/api/generate-testcases')
      .send({ url: 'invalid-url' }); // Некоректний запит

    // Перевіряємо, що статус відповіді 400
    expect(response.status).toBe(400);
    // Перевіряємо, що сервіс не був викликаний
    expect(OpenAIService.generateTestCasesFromElement).not.toHaveBeenCalled();
  });

  it('should return 500 if OpenAI service fails', async () => {
    // Налаштовуємо мок OpenAI на помилку
    (OpenAIService.shouldAskForClarification as jest.Mock).mockReturnValue(false);
    (OpenAIService.generateTestCasesFromElement as jest.Mock).mockRejectedValue(new Error('OpenAI Error'));

    const response = await request(app)
      .post('/api/generate-testcases')
      .send({ html: '<button>Login</button>', url: 'http://localhost/login' });

    // Перевіряємо, що статус відповіді 500
    expect(response.status).toBe(500);
  });
});
