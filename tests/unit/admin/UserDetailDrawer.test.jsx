/**
 * @file UserDetailDrawer 组件测试
 * 测试管理员用户详情抽屉的权限开关与基本渲染
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserDetailDrawer from '../../../src/admin/components/UserDetailDrawer.jsx';

// Mock AWSClientContext（提供最小化的 DynamoDB/S3 客户端）
vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({
    clients: {
      dynamoDB: { clientTag: 'mock-ddb' },
      s3: { clientTag: 'mock-s3' },
    },
  }),
}));

// Mock DynamoDB 服务
vi.mock('../../../src/admin/services/dynamodb', () => ({
  TABLES: { EVENTS: 'VoiceFemEvents' },
  EVENT_TYPES: { self_test: '自测' },
  queryByUserId: vi.fn(),
  updateUserAdminStatus: vi.fn(),
}));

// Mock S3 服务
vi.mock('../../../src/admin/services/s3', () => ({
  getPresignedUrl: vi.fn(),
}));

import { queryByUserId, updateUserAdminStatus } from '../../../src/admin/services/dynamodb';
import { getPresignedUrl } from '../../../src/admin/services/s3';

describe('UserDetailDrawer 组件测试', () => {
  const baseUser = {
    userId: 'user-123',
    email: 'user@example.com',
    profile: {
      name: '测试用户',
      nickname: '测试昵称',
      isNamePublic: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryByUserId.mockResolvedValue([]);
    getPresignedUrl.mockResolvedValue(null);
    updateUserAdminStatus.mockResolvedValue({});
  });

  it('应该渲染权限设置区域（视觉快照）', async () => {
    // 使用 open=true 直接渲染抽屉内容
    const { container } = render(
      <UserDetailDrawer user={baseUser} open onClose={vi.fn()} onUserUpdate={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('权限设置')).toBeInTheDocument();
    });

    expect(container).toMatchSnapshot();
  });

  it('点击管理员权限开关应更新状态并回调', async () => {
    const onUserUpdate = vi.fn();

    render(
      <UserDetailDrawer user={baseUser} open onClose={vi.fn()} onUserUpdate={onUserUpdate} />
    );

    // 等待基础内容加载完成
    await waitFor(() => {
      expect(screen.getByText('管理员权限')).toBeInTheDocument();
    });

    // 通过权限设置区域定位开关按钮
    const section = screen.getByText('管理员权限').closest('section');
    const toggleButton = section?.querySelector('button');

    expect(toggleButton).toBeTruthy();
    await userEvent.click(toggleButton);

    // 应调用更新管理员状态的服务
    await waitFor(() => {
      expect(updateUserAdminStatus).toHaveBeenCalledWith(
        expect.any(Object),
        baseUser.userId,
        true
      );
    });

    // 应通知父组件更新用户信息
    expect(onUserUpdate).toHaveBeenCalledWith({ ...baseUser, isAdmin: true });
  });
});
