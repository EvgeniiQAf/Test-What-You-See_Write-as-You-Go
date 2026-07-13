process.env.OPENAI_API_KEY = 'mock-key';
import request from 'supertest';
import app from '../app';
import { testmoClient } from '../services/testmo.service';
import axios from 'axios';
import { env } from '../config/env';

jest.mock('../services/testmo.service', () => ({
  testmoClient: {
    post: jest.fn(),
  },
}));

jest.mock('axios');

describe('POST /api/create-testcase', () => {
  const standardPayload = {
    case: {
      title: {
        ua: "Перевірка входу",
        en: "Verify Login"
      },
      preconditions: {
        ua: ["Відкрито екран входу"],
        en: ["Login screen is opened"]
      },
      steps: [
        {
          step: {
            ua: "Натиснути кнопку Вхід",
            en: "Click Login button"
          },
          expectedResults: {
            ua: ["Користувач увійшов"],
            en: ["User is logged in"]
          }
        }
      ],
      priority: "Medium",
      tags: ["smoke"]
    }
  };

  beforeEach(() => {
    (testmoClient.post as jest.Mock).mockClear();
    (axios.post as jest.Mock).mockClear();
  });

  it('should call TestmoProvider when activeTms is testmo', async () => {
    const originalTms = env.activeTms;
    const originalFolder = env.testmoFolderId;
    env.activeTms = 'testmo';
    env.testmoFolderId = '44';
    (testmoClient.post as jest.Mock).mockResolvedValue({
      data: {
        result: [{ id: 123 }]
      }
    });

    const response = await request(app)
      .post('/api/create-testcase')
      .send(standardPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.created.id).toBe(123);
    expect(testmoClient.post).toHaveBeenCalledTimes(1);
    env.activeTms = originalTms;
    env.testmoFolderId = originalFolder;
  });

  it('should call TestomatProvider when activeTms is testomat', async () => {
    const originalTms = env.activeTms;
    env.activeTms = 'testomat';
    env.testomatApiKey = 'tstmt_key123';
    (axios.post as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        tests: [{ id: 'testomat-789' }]
      }
    });

    const response = await request(app)
      .post('/api/create-testcase')
      .send(standardPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.created.id).toBe('testomat-789');
    expect(axios.post).toHaveBeenCalledTimes(1);
    env.activeTms = originalTms;
  });
});
