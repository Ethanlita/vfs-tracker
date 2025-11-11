/**
 * @file Voice Test Session API 集成测试
 * @description 测试嗓音测试会话相关 API 的调用和响应
 * 
 * 当前 API 接口:
 * - createVoiceTestSession(userId?) - 创建新的测试会话
 * - getVoiceTestUploadUrl(sessionId, step, fileName, contentType) - 获取上传URL
 * - requestVoiceTestAnalyze(sessionId, calibration, forms) - 请求分析
 * - getVoiceTestResults(sessionId) - 获取测试结果
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { 
  createVoiceTestSession,
  getVoiceTestUploadUrl,
  requestVoiceTestAnalyze,
  getVoiceTestResults
} from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { ApiError } from '../../../src/utils/apiError.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

describe('Voice Test Session API 集成测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:complete-user-001',
      email: 'complete@example.com',
      nickname: 'Complete User'
    });
  });

  describe('createVoiceTestSession', () => {
    it('应该成功创建测试会话', async () => {
      const result = await createVoiceTestSession();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('sessionId');
      expect(typeof result.sessionId).toBe('string');
      expect(result.sessionId.length).toBeGreaterThan(0);
    });

    it('应该接受可选的 userId 参数', async () => {
      const userId = 'us-east-1:test-user-123';
      const result = await createVoiceTestSession(userId);

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
    });

    it('不传 userId 时也应该成功创建会话', async () => {
      const result = await createVoiceTestSession();

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('返回的 sessionId 应该是有效的 UUID 格式', async () => {
      const result = await createVoiceTestSession();

      // UUID v4 格式验证
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.sessionId).toMatch(uuidRegex);
    });
  });

  describe('getVoiceTestUploadUrl', () => {
    it('应该成功获取上传 URL', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const step = 'ah';
      const fileName = 'test.wav';
      const contentType = 'audio/wav';

      const result = await getVoiceTestUploadUrl(sessionId, step, fileName, contentType);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('putUrl');
      expect(result).toHaveProperty('objectKey');
      expect(typeof result.putUrl).toBe('string');
      expect(typeof result.objectKey).toBe('string');
    });

    it('返回的 putUrl 应该是有效的 URL', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await getVoiceTestUploadUrl(sessionId, 'ah', 'test.wav', 'audio/wav');

      expect(result.putUrl).toMatch(/^https?:\/\//);
    });

    it('应该能处理不同的测试步骤', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const steps = ['ah', 'ee', 'low', 'high', 'sentence'];

      for (const step of steps) {
        const result = await getVoiceTestUploadUrl(sessionId, step, 'test.wav', 'audio/wav');
        expect(result.putUrl).toBeDefined();
        expect(result.objectKey).toBeDefined();
      }
    });

    it('objectKey 应该包含会话信息', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const step = 'ah';
      const fileName = 'recording.wav';

      const result = await getVoiceTestUploadUrl(sessionId, step, fileName, 'audio/wav');

      // objectKey 应该包含 sessionId 和 fileName
      expect(result.objectKey).toContain(sessionId);
      expect(result.objectKey).toContain(fileName);
    });

    it('应该支持不同的文件类型', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const fileTypes = [
        { fileName: 'test.wav', contentType: 'audio/wav' },
        { fileName: 'test.mp3', contentType: 'audio/mpeg' },
        { fileName: 'test.m4a', contentType: 'audio/mp4' }
      ];

      for (const { fileName, contentType } of fileTypes) {
        const result = await getVoiceTestUploadUrl(sessionId, 'ah', fileName, contentType);
        expect(result.putUrl).toBeDefined();
        expect(result.objectKey).toBeDefined();
      }
    });
  });

  describe('requestVoiceTestAnalyze', () => {
    it('应该成功提交分析请求', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const calibration = {
        micSensitivity: 0.8,
        backgroundNoise: 35
      };
      const forms = {
        age: 25,
        gender: 'female',
        hasVoiceIssues: false
      };

      const result = await requestVoiceTestAnalyze(sessionId, calibration, forms);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('sessionId');
      expect(result.sessionId).toBe(sessionId);
    });

    it('返回的状态应该是有效值', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const calibration = { micSensitivity: 0.8, backgroundNoise: 35 };
      const forms = { age: 25, gender: 'female' };

      const result = await requestVoiceTestAnalyze(sessionId, calibration, forms);

      // 状态应该是 queued, processing 或 done 中的一个
      expect(['queued', 'processing', 'done']).toContain(result.status);
    });

    it('应该接受完整的校准数据', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const calibration = {
        micSensitivity: 0.85,
        backgroundNoise: 40,
        roomAcoustics: 'normal'
      };
      const forms = {
        age: 30,
        gender: 'male',
        hasVoiceIssues: true,
        voiceIssueDetails: 'Hoarseness'
      };

      const result = await requestVoiceTestAnalyze(sessionId, calibration, forms);

      expect(result.status).toBeDefined();
      expect(result.sessionId).toBe(sessionId);
    });
  });

  describe('getVoiceTestResults', () => {
    it('应该成功获取测试结果', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';

      const result = await getVoiceTestResults(sessionId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
    });

    it('结果应该包含状态信息', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';

      const result = await getVoiceTestResults(sessionId);

      // 状态应该是已知的值之一
      expect(['queued', 'processing', 'done', 'failed']).toContain(result.status);
    });

    it('当状态为 done 时应该包含结果数据', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';

      const result = await getVoiceTestResults(sessionId);

      if (result.status === 'done') {
        // done 状态应该包含实际的测试结果
        expect(result).toHaveProperty('results');
      }
    });

    it('应该能处理 processing 状态', async () => {
      const sessionId = 'processing-session-id';

      const result = await getVoiceTestResults(sessionId);

      // processing 状态是有效的
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('应该能处理 queued 状态', async () => {
      const sessionId = 'queued-session-id';

      const result = await getVoiceTestResults(sessionId);

      // queued 状态是有效的
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('Voice Test Workflow', () => {
    it('应该支持完整的测试流程', async () => {
      // 1. 创建会话
      const session = await createVoiceTestSession();
      expect(session.sessionId).toBeDefined();

      // 2. 获取上传 URL
      const upload = await getVoiceTestUploadUrl(
        session.sessionId,
        'ah',
        'test.wav',
        'audio/wav'
      );
      expect(upload.putUrl).toBeDefined();
      expect(upload.objectKey).toBeDefined();

      // 3. 请求分析
      const analysis = await requestVoiceTestAnalyze(
        session.sessionId,
        { micSensitivity: 0.8, backgroundNoise: 35 },
        { age: 25, gender: 'female' }
      );
      expect(analysis.status).toBeDefined();
      expect(analysis.sessionId).toBe(session.sessionId);

      // 4. 获取结果
      const results = await getVoiceTestResults(session.sessionId);
      expect(results.status).toBeDefined();
    });
  });

  describe('错误状态码处理 (P1.2.4 - Phase 3.3 Code Review)', () => {
    const testSessionId = 'test-session-001';
    const testUserId = 'us-east-1:test-user';

    describe('createVoiceTestSession 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.post(`${API_URL}/sessions`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await createVoiceTestSession(testUserId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 429 请求限流错误', async () => {
        server.use(
          http.post(`${API_URL}/sessions`, () => {
            return HttpResponse.json(
              { error: 'Too Many Requests', message: '创建会话过于频繁' },
              { status: 429 }
            );
          })
        );

        try {
          await createVoiceTestSession(testUserId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(429);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/sessions`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '会话创建失败' },
              { status: 500 }
            );
          })
        );

        try {
          await createVoiceTestSession(testUserId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });

    describe('getVoiceTestUploadUrl 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.post(`${API_URL}/uploads`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await getVoiceTestUploadUrl(testSessionId, 'ah', 'test.wav', 'audio/wav');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 404 会话不存在错误', async () => {
        server.use(
          http.post(`${API_URL}/uploads`, () => {
            return HttpResponse.json(
              { error: 'Not Found', message: '会话不存在' },
              { status: 404 }
            );
          })
        );

        try {
          await getVoiceTestUploadUrl(testSessionId, 'ah', 'test.wav', 'audio/wav');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(404);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/uploads`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: 'S3 签名失败' },
              { status: 500 }
            );
          })
        );

        try {
          await getVoiceTestUploadUrl(testSessionId, 'ah', 'test.wav', 'audio/wav');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });

    describe('requestVoiceTestAnalyze 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.post(`${API_URL}/analyze`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await requestVoiceTestAnalyze(testSessionId, {}, {});
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 400 数据验证错误', async () => {
        server.use(
          http.post(`${API_URL}/analyze`, () => {
            return HttpResponse.json(
              { error: 'Bad Request', message: '分析参数格式错误' },
              { status: 400 }
            );
          })
        );

        try {
          await requestVoiceTestAnalyze(testSessionId, {}, {});
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(400);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/analyze`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '分析服务失败' },
              { status: 500 }
            );
          })
        );

        try {
          await requestVoiceTestAnalyze(testSessionId, {}, {});
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });

    describe('getVoiceTestResults 错误状态码', () => {
      it('应该处理 404 结果不存在错误', async () => {
        server.use(
          http.get(`${API_URL}/results/${testSessionId}`, () => {
            return HttpResponse.json(
              { error: 'Not Found', message: '测试结果不存在' },
              { status: 404 }
            );
          })
        );

        try {
          await getVoiceTestResults(testSessionId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(404);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.get(`${API_URL}/results/${testSessionId}`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '结果查询失败' },
              { status: 500 }
            );
          })
        );

        try {
          await getVoiceTestResults(testSessionId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });
  });
});
