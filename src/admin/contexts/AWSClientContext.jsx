/**
 * @file AWS 客户端上下文
 * 管理 IAM 凭证状态和 AWS SDK 客户端实例
 *
 * 功能：
 * - 提供 DynamoDB、S3、STS 客户端
 * - 支持凭证本地加密持久化（使用 PIN 码保护）
 * - 自动检测已保存的凭证，需要 PIN 解锁
 */

import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { SSMClient } from '@aws-sdk/client-ssm';
import {
  saveCredentialsSecure,
  loadCredentialsSecure,
  clearEncryptedCredentials,
  hasEncryptedCredentials,
  validatePIN,
  SecureCredentialStorageError
} from '../utils/secureCredentialStorage';

// AWS 区域配置 - 从环境变量读取，回退到默认值
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

// 创建上下文
const AWSClientContext = createContext(null);

// STS 明确表示密钥本身不可用时，才允许清除本地加密记录。
const INVALID_CREDENTIAL_ERROR_NAMES = new Set([
  'ExpiredToken',
  'ExpiredTokenException',
  'InvalidClientTokenId',
  'InvalidSignatureException',
  'SignatureDoesNotMatch',
  'UnrecognizedClientException',
]);

/**
 * 将解锁异常归类为稳定的用户结果。
 * 默认保留凭证，因为未知异常不能证明密钥已经失效。
 * @param {unknown} error - 解密或 STS 验证抛出的异常
 * @returns {{ message: string, clearSaved: boolean }}
 */
export function classifyCredentialUnlockError(error) {
  if (error instanceof SecureCredentialStorageError) {
    if (error.code === 'PIN_OR_DATA_INVALID') {
      return { message: error.message, clearSaved: false };
    }
    if (error.code === 'UNSUPPORTED_VERSION') {
      return { message: error.message, clearSaved: false };
    }
    return { message: error.message, clearSaved: true };
  }

  const errorNames = [error?.name, error?.Code, error?.code];
  if (errorNames.some(errorName => INVALID_CREDENTIAL_ERROR_NAMES.has(errorName))) {
    return { message: 'AWS 已明确拒绝该凭证，请重新登录', clearSaved: true };
  }

  return {
    message: '暂时无法连接 AWS 验证凭证，请检查网络后重试',
    clearSaved: false,
  };
}

/**
 * AWS 客户端提供者组件
 * 管理凭证状态和 AWS SDK 客户端
 */
export function AWSClientProvider({ children }) {
  // 凭证状态（只存在内存中，除非用户选择保存）
  const [credentials, setCredentials] = useState(null);
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // 管理员信息（从 STS GetCallerIdentity 获取）
  const [adminInfo, setAdminInfo] = useState(null);
  // 初始加载状态（检查是否有保存的凭证）
  const [isLoading, setIsLoading] = useState(false);
  // 是否有加密保存的凭证（需要 PIN 解锁）
  const [hasSavedCredentials, setHasSavedCredentials] = useState(() => hasEncryptedCredentials());
  // 错误状态
  const [error, setError] = useState(null);

  /**
   * 创建 AWS 客户端实例
   * 使用 useMemo 确保只在凭证变化时重新创建
   */
  const clients = useMemo(() => {
    if (!credentials) return null;

    const config = {
      region: AWS_REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    };

    // 创建 DynamoDB 客户端
    const dynamoDBClient = new DynamoDBClient(config);
    // 使用 DocumentClient 简化操作（自动处理类型转换）
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    // 创建 S3 客户端
    // 注意：在浏览器中使用需要确保 CORS 正确配置
    const s3Client = new S3Client({
      ...config,
      // 使用路径样式 URL (bucket.s3.region.amazonaws.com -> s3.region.amazonaws.com/bucket)
      forcePathStyle: false, // 默认使用虚拟主机样式，与 CORS 配置一致
    });



    return {
      dynamoDB: docClient,
      dynamoDBRaw: dynamoDBClient,
      s3: s3Client,
      sts: new STSClient(config),
      ssm: new SSMClient(config),
    };
  }, [credentials]);

  /**
   * 验证凭证并登录
   * @param {string} accessKeyId - AWS Access Key ID
   * @param {string} secretAccessKey - AWS Secret Access Key
   * @param {boolean} rememberMe - 是否保存到本地
   * @param {string} pin - 如果 rememberMe 为 true，用于加密的 PIN 码
   * @returns {Promise<{success: boolean, identity?: object, error?: string}>}
   */
  const login = useCallback(async (accessKeyId, secretAccessKey, rememberMe = false, pin = null) => {
    setError(null);
    setIsLoading(true);

    const tempCredentials = { accessKeyId, secretAccessKey };
    const tempSTS = new STSClient({
      region: AWS_REGION,
      credentials: tempCredentials,
    });

    try {
      // 通过 GetCallerIdentity 验证凭证有效性
      const identity = await tempSTS.send(new GetCallerIdentityCommand({}));

      // 如果选择记住，使用 PIN 加密保存到 localStorage
      if (rememberMe && pin) {
        const pinValidation = validatePIN(pin);
        if (!pinValidation.valid) {
          throw new Error(pinValidation.error);
        }
        // 必须等待持久化成功后再认证和导航，避免刷新中断仍在执行的加密写入。
        await saveCredentialsSecure(accessKeyId, secretAccessKey, pin);
        setHasSavedCredentials(true);
      }

      // 验证与可选持久化均成功后，再发布认证状态。
      setCredentials(tempCredentials);
      setAdminInfo({
        arn: identity.Arn,
        accountId: identity.Account,
        userId: identity.UserId,
      });
      setIsAuthenticated(true);


      setIsLoading(false);
      return { success: true, identity };
    } catch (err) {

      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * 使用 PIN 解锁已保存的凭证
   * @param {string} pin - 用户输入的 PIN 码
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const unlockWithPIN = useCallback(async (pin) => {
    setError(null);
    setIsLoading(true);

    try {
      // 解密凭证
      const stored = await loadCredentialsSecure(pin);
      if (!stored) {
        setHasSavedCredentials(false);
        setIsLoading(false);
        return { success: false, error: '没有找到保存的凭证' };
      }

      // 验证凭证是否仍然有效
      const tempSTS = new STSClient({
        region: AWS_REGION,
        credentials: {
          accessKeyId: stored.accessKeyId,
          secretAccessKey: stored.secretAccessKey,
        },
      });

      const identity = await tempSTS.send(new GetCallerIdentityCommand({}));

      // 凭证有效，保存状态
      setCredentials({
        accessKeyId: stored.accessKeyId,
        secretAccessKey: stored.secretAccessKey,
      });
      setAdminInfo({
        arn: identity.Arn,
        accountId: identity.Account,
        userId: identity.UserId,
      });
      setIsAuthenticated(true);


      setIsLoading(false);
      return { success: true };
    } catch (err) {

      const result = classifyCredentialUnlockError(err);
      setError(result.message);
      setIsLoading(false);

      // 只有损坏数据或 STS 明确拒绝才删除；网络、超时和服务故障均保留。
      if (result.clearSaved) {
        clearEncryptedCredentials();
        setHasSavedCredentials(false);
      }

      return { success: false, error: result.message };
    }
  }, []);

  /**
   * 用户主动放弃当前保存的凭证，并同步上下文中的保存状态。
   */
  const forgetSavedCredentials = useCallback(() => {
    clearEncryptedCredentials();
    setHasSavedCredentials(false);
    setError(null);
  }, []);

  /**
   * 登出
   * @param {boolean} clearSaved - 是否同时清除保存的凭证
   */
  const logout = useCallback((clearSaved = false) => {
    setCredentials(null);
    setIsAuthenticated(false);
    setAdminInfo(null);
    setError(null);

    if (clearSaved) {
      clearEncryptedCredentials();
      setHasSavedCredentials(false);

    }


  }, []);

  // 上下文值
  const contextValue = useMemo(() => ({
    // 客户端
    clients,
    // 状态
    isAuthenticated,
    isLoading,
    adminInfo,
    error,
    // 是否有保存的加密凭证（需要 PIN 解锁）
    hasSavedCredentials,
    // 操作
    login,
    logout,
    unlockWithPIN,
    forgetSavedCredentials,
  }), [clients, isAuthenticated, isLoading, adminInfo, error, hasSavedCredentials, login, logout, unlockWithPIN, forgetSavedCredentials]);

  return (
    <AWSClientContext.Provider value={contextValue}>
      {children}
    </AWSClientContext.Provider>
  );
}

/**
 * 使用 AWS 客户端的 Hook
 * @returns {{
 *   clients: { dynamoDB: DynamoDBDocumentClient, s3: S3Client, sts: STSClient } | null,
 *   isAuthenticated: boolean,
 *   isLoading: boolean,
 *   adminInfo: { arn: string, accountId: string, userId: string } | null,
 *   error: string | null,
 *   hasSavedCredentials: boolean,
 *   login: (accessKeyId: string, secretAccessKey: string, rememberMe?: boolean, pin?: string) => Promise<{success: boolean}>,
 *   logout: (clearSaved?: boolean) => void,
 *   unlockWithPIN: (pin: string) => Promise<{success: boolean, error?: string}>,
 *   forgetSavedCredentials: () => void
 * }}
 */
export function useAWSClients() {
  const context = useContext(AWSClientContext);
  if (!context) {
    throw new Error('useAWSClients 必须在 AWSClientProvider 内部使用');
  }
  return context;
}

export default AWSClientContext;
