import request from 'supertest';
import app from '../app';
import { testmoClient } from '../services/testmo.service';

// Мокуємо axios клієнт для Testmo
jest.mock('../services/testmo.service', () => ({
  testmoClient: {
    post: jest.fn(),
  },
}));

describe('POST /api/create-testmo-case', () => {
  const mockCasePayload = {
    case: {
      title: 'New Test Case',
      template: 'steps',
      steps: [{ content: 'Step 1' }],
    },
  };

  const mockTestmoResponse = {
    data: { id: 456 },
  };

  beforeEach(() => {
    // Скидаємо мок перед кожним тестом
    (testmoClient.post as jest.Mock).mockClear();
  });

  it('should return 200 and success on valid case creation', async () => {
    // Налаштовуємо мок для успішного створення
    (testmoClient.post as jest.Mock).mockResolvedValue(mockTestmoResponse);

    const response = await request(app)
      .post('/api/create-testmo-case')
      .send(mockCasePayload);

    // Перевіряємо, що статус відповіді 200
    expect(response.status).toBe(200);
    // Перевіряємо тіло відповіді
    expect(response.body.success).toBe(true);
    expect(response.body.created).toEqual(mockTestmoResponse.data);
    // Перевіряємо, що клієнт Testmo був викликаний
    expect(testmoClient.post).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if validation fails', async () => {
    const response = await request(app)
      .post('/api/create-testmo-case')
      .send({ case: { title: '' } }); // Некоректний запит

    // Перевіряємо, що статус відповіді 400
    expect(response.status).toBe(400);
    // Перевіряємо, що клієнт Testmo не був викликаний
    expect(testmoClient.post).not.toHaveBeenCalled();
  });

  it('should return 500 if Testmo API fails', async () => {
    // Налаштовуємо мок на помилку
    (testmoClient.post as jest.Mock).mockRejectedValue(new Error('Testmo API Error'));

    const response = await request(app)
      .post('/api/create-testmo-case')
      .send(mockCasePayload);

    // Перевіряємо, що статус відповіді 500
    expect(response.status).toBe(500);
  });
});
