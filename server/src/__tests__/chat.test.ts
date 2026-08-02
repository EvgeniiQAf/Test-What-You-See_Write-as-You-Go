import request from 'supertest';
import app from '../app';
import { ChatService } from '../services/chat.service';

jest.mock('../services/chat.service');

describe('POST /api/chat', () => {
  beforeEach(() => {
    (ChatService.prototype.chatWithAssistant as jest.Mock).mockClear();
  });

  it('should return 200 and reply when chatting with assistant including generatedTestCases', async () => {
    (ChatService.prototype.chatWithAssistant as jest.Mock).mockResolvedValue({ reply: 'Here are the details about your generated tests.' });

    const mockGeneratedCases = [
      {
        title: { ua: 'Перевірка авторизації', en: 'Verify Login' },
        preconditions: { ua: ['Форма відкрита'], en: ['Form is open'] },
        steps: [
          {
            step: { ua: 'Ввести логін', en: 'Enter login' },
            expectedResults: { ua: ['Успіх'], en: ['Success'] },
          },
        ],
      },
    ];

    const response = await request(app)
      .post('/api/chat')
      .send({
        userPrompt: 'Розкажи про мої тест кейси',
        generatedTestCases: mockGeneratedCases,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reply: 'Here are the details about your generated tests.' });
    expect(ChatService.prototype.chatWithAssistant).toHaveBeenCalledTimes(1);
    expect(ChatService.prototype.chatWithAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: 'Розкажи про мої тест кейси',
        generatedTestCases: mockGeneratedCases,
      })
    );
  });

  it('should return 400 if userPrompt is missing', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({});

    expect(response.status).toBe(400);
    expect(ChatService.prototype.chatWithAssistant).not.toHaveBeenCalled();
  });
});
