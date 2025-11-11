/**
 * @file Amplify Auth Mock
 * @description Mock aws-amplify/auth 模块，用于测试
 */

import { vi } from 'vitest';

/**
 * Mock fetchAuthSession
 * 默认返回一个已认证的 session
 */
export const mockFetchAuthSession = vi.fn(() => 
  Promise.resolve({
    tokens: {
      idToken: {
        toString: () => 'mock-id-token-12345',
        payload: {
          sub: 'us-east-1:test-user-123',
          email: 'test@example.com',
          nickname: 'testuser',
          'cognito:username': 'testuser',
          token_use: 'id',
          auth_time: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      accessToken: {
        toString: () => 'mock-access-token-12345',
      },
    },
    credentials: {
      accessKeyId: 'mock-access-key',
      secretAccessKey: 'mock-secret-key',
      sessionToken: 'mock-session-token',
    },
  })
);

/**
 * Mock signOut
 */
export const mockSignOut = vi.fn(() => Promise.resolve());

/**
 * Mock signIn
 */
export const mockSignIn = vi.fn((username, password) => 
  Promise.resolve({
    isSignedIn: true,
    nextStep: {
      signInStep: 'DONE',
    },
  })
);

/**
 * Mock signUp
 */
export const mockSignUp = vi.fn((username, password, options) => 
  Promise.resolve({
    isSignUpComplete: false,
    nextStep: {
      signUpStep: 'CONFIRM_SIGN_UP',
    },
    userId: 'us-east-1:new-user-123',
  })
);

/**
 * Mock confirmSignUp
 */
export const mockConfirmSignUp = vi.fn((username, code) => 
  Promise.resolve({
    isSignUpComplete: true,
    nextStep: {
      signUpStep: 'DONE',
    },
  })
);

/**
 * Mock getCurrentUser
 */
export const mockGetCurrentUser = vi.fn(() => 
  Promise.resolve({
    userId: 'us-east-1:test-user-123',
    username: 'testuser',
  })
);

/**
 * Mock fetchUserAttributes
 */
export const mockFetchUserAttributes = vi.fn(() => 
  Promise.resolve({
    sub: 'us-east-1:test-user-123',
    email: 'test@example.com',
    email_verified: true,
    nickname: 'testuser',
  })
);

/**
 * Mock updateUserAttributes
 */
export const mockUpdateUserAttributes = vi.fn((attributes) => 
  Promise.resolve({
    isUpdated: true,
  })
);

/**
 * 导出所有 mock 函数
 */
export const mockAmplifyAuth = {
  fetchAuthSession: mockFetchAuthSession,
  signOut: mockSignOut,
  signIn: mockSignIn,
  signUp: mockSignUp,
  confirmSignUp: mockConfirmSignUp,
  getCurrentUser: mockGetCurrentUser,
  fetchUserAttributes: mockFetchUserAttributes,
  updateUserAttributes: mockUpdateUserAttributes,
};

/**
 * 重置所有 mock
 */
export function resetAuthMocks() {
  mockFetchAuthSession.mockClear();
  mockSignOut.mockClear();
  mockSignIn.mockClear();
  mockSignUp.mockClear();
  mockConfirmSignUp.mockClear();
  mockGetCurrentUser.mockClear();
  mockFetchUserAttributes.mockClear();
  mockUpdateUserAttributes.mockClear();
}

/**
 * 设置为未认证状态
 */
export function setUnauthenticated() {
  mockFetchAuthSession.mockRejectedValueOnce(
    new Error('User is not authenticated')
  );
}

/**
 * 设置为已认证状态（自定义用户）
 */
export function setAuthenticated(userId, email, nickname) {
  mockFetchAuthSession.mockResolvedValueOnce({
    tokens: {
      idToken: {
        toString: () => 'mock-id-token-custom',
        payload: {
          sub: userId,
          email,
          nickname,
          'cognito:username': nickname,
          token_use: 'id',
        },
      },
    },
  });
}
