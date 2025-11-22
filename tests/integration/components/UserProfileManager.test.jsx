/**
 * @file UserProfileManager 组件集成测试
 * @description 测试用户资料管理组件的编辑、保存、头像更新等功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import UserProfileManager from '../../../src/components/UserProfileManager';
import * as api from '../../../src/api';
import * as avatarUtils from '../../../src/utils/avatar';

// Mock API 和工具模块
vi.mock('../../../src/api');
vi.mock('../../../src/utils/avatar');

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth()
  };
});

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

/**
 * 测试数据
 */
const mockUser = {
  userId: 'test-user-123',
  email: 'test@example.com'
};

const mockUserProfile = {
  userId: 'test-user-123',
  profile: {
    name: '测试用户',
    isNamePublic: true,
    socials: [
      { platform: 'Twitter', handle: '@testuser' },
      { platform: 'Discord', handle: 'testuser#1234' }
    ],
    areSocialsPublic: true,
    avatarKey: 'avatars/test-user-123/latest.png'
  }
};

const mockCognitoUserInfo = {
  nickname: '测试昵称',
  email: 'test@example.com',
  email_verified: true
};

/**
 * 创建渲染包装器
 */
const renderComponent = () => {
  return render(
    <BrowserRouter>
      <UserProfileManager />
    </BrowserRouter>
  );
};

describe('UserProfileManager 组件集成测试', () => {
  let user;

  const setupAuthMock = (overrides = {}) => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      userProfile: mockUserProfile,
      refreshUserProfile: vi.fn(),
      cognitoUserInfo: mockCognitoUserInfo,
      cognitoLoading: false,
      updateCognitoUserInfo: vi.fn(),
      refreshCognitoUserInfo: vi.fn(),
      resendEmailVerification: vi.fn(),
      ...overrides
    });
  };

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // 设置默认 Auth mock
    setupAuthMock();

    // Mock avatar URL
    avatarUtils.getUserAvatarUrl.mockResolvedValue('https://example.com/avatar.jpg');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('基础渲染', () => {
    it('应该渲染用户资料信息', () => {
      setupAuthMock();
      renderComponent();

      // 检查标题渲染
      expect(screen.getByText('个人资料管理')).toBeInTheDocument();
      
      // 检查显示的用户名
      expect(screen.getByText(/测试用户/)).toBeInTheDocument();
    });

    it('应该显示社交媒体信息', async () => {
      setupAuthMock();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Twitter/)).toBeInTheDocument();
      });

      expect(screen.getByText(/@testuser/)).toBeInTheDocument();
    });

    it('当没有用户资料时应该显示空状态', () => {
      setupAuthMock({ userProfile: null });
      renderComponent();

      // 应该显示编辑按钮（即使没有资料也可以创建）
      expect(screen.getByText('编辑资料')).toBeInTheDocument();
    });
  });

  describe('编辑功能', () => {
    it('点击"编辑资料"按钮应该进入编辑模式', async () => {
      setupAuthMock();
      renderComponent();

      const editButton = screen.getByRole('button', { name: '编辑资料' });
      await user.click(editButton);

      // 检查是否显示保存和取消按钮
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
      });
    });

    it('应该能够修改用户名', async () => {
      setupAuthMock();
      renderComponent();

      // 进入编辑模式
      await user.click(screen.getByRole('button', { name: '编辑资料' }));

      // 找到用户名输入框并修改
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
      await user.clear(nameInput);
      await user.type(nameInput, '新用户名');

      expect(nameInput.value).toBe('新用户名');
    });

    it('应该能够切换公开性设置', async () => {
      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));

      // 找到公开性复选框
      await waitFor(() => {
        expect(screen.getByLabelText('在公共页面显示我的名称')).toBeInTheDocument();
      });
      
      const namePublicCheckbox = screen.getByLabelText('在公共页面显示我的名称');
      const initialChecked = namePublicCheckbox.checked;
      
      await user.click(namePublicCheckbox);

      // 验证状态改变
      expect(namePublicCheckbox.checked).toBe(!initialChecked);
    });
  });

  describe('保存功能', () => {
    it('保存应该调用 API 并刷新用户资料', async () => {
      api.updateUserProfile.mockResolvedValue({ success: true });
      
      const mockRefreshUserProfile = vi.fn();
      setupAuthMock({ refreshUserProfile: mockRefreshUserProfile });
      renderComponent();

      // 进入编辑模式
      await user.click(screen.getByRole('button', { name: '编辑资料' }));

      // 等待输入框出现
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入您的显示名称')).toBeInTheDocument();
      });

      // 修改用户名
      const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
      await user.type(nameInput, '新用户名');

      // 保存
      await user.click(screen.getByRole('button', { name: /保存/ }));

      // 验证 API 调用
      await waitFor(() => {
        expect(api.updateUserProfile).toHaveBeenCalled();
        expect(mockRefreshUserProfile).toHaveBeenCalled();
        // API 调用应该包含 profile 对象和更新的名称
        const callArgs = api.updateUserProfile.mock.calls[0];
        expect(callArgs[0]).toBe('test-user-123');
        expect(callArgs[1].profile.name).toContain('新用户名');
      }, { timeout: 3000 });
    });

    it('保存成功应该退出编辑模式', async () => {
      api.updateUserProfile.mockResolvedValue({ success: true });
      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));
      
      // 输入用户名
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入您的显示名称')).toBeInTheDocument();
      });
      const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
      await user.type(nameInput, '测试名称');

      // 保存
      await user.click(screen.getByRole('button', { name: /保存/ }));

      // 等待操作完成，编辑按钮应该重新显示
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '编辑资料' })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('保存失败应该显示错误消息', async () => {
      api.updateUserProfile.mockRejectedValue(new Error('网络错误'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));
      
      // 输入用户名
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入您的显示名称')).toBeInTheDocument();
      });
      const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
      await user.type(nameInput, '测试名称');

      await user.click(screen.getByRole('button', { name: /保存/ }));

      await waitFor(() => {
        // 应该显示错误消息
        expect(screen.getByText(/更新失败|错误/)).toBeInTheDocument();
      }, { timeout: 3000 });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('取消功能', () => {
    it('取消应该退出编辑模式', async () => {
      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));

      // 等待进入编辑模式
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
      });

      // 取消
      await user.click(screen.getByRole('button', { name: '取消' }));

      // 应该返回非编辑模式
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '编辑资料' })).toBeInTheDocument();
      });
    });
  });

  describe('社交媒体管理', () => {
    it('应该显示现有的社交媒体账号', async () => {
      setupAuthMock();
      renderComponent();

      // 应该显示 Twitter 和 Discord
      expect(screen.getByText(/Twitter/)).toBeInTheDocument();
      expect(screen.getByText(/@testuser/)).toBeInTheDocument();
      expect(screen.getByText(/Discord/)).toBeInTheDocument();
      expect(screen.getByText(/testuser#1234/)).toBeInTheDocument();
    });

    it('应该能够删除社交媒体账号', async () => {
      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));

      // 等待进入编辑模式
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
      });

      // 查找删除按钮
      const deleteButtons = screen.getAllByRole('button', { name: '删除' });
      expect(deleteButtons.length).toBeGreaterThan(0);

      // 点击第一个删除按钮
      await user.click(deleteButtons[0]);

      // 验证社交媒体项减少（通过删除按钮数量）
      await waitFor(() => {
        const remainingDeleteButtons = screen.getAllByRole('button', { name: '删除' });
        expect(remainingDeleteButtons.length).toBeLessThan(deleteButtons.length);
      });
    });
  });

  describe('头像管理', () => {
    it('应该显示头像', async () => {
      setupAuthMock();
      renderComponent();

      // 等待头像加载
      await waitFor(() => {
        const avatarImg = screen.getByAltText('头像');
        expect(avatarImg).toBeInTheDocument();
        expect(avatarImg.src).toBe('https://example.com/avatar.jpg');
      });
    });
  });

  describe('Cognito 用户信息', () => {
    it('应该显示 Cognito 用户信息', async () => {
      setupAuthMock();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('测试昵称')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('应该显示邮箱验证状态', async () => {
      setupAuthMock();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('已验证')).toBeInTheDocument();
      });
    });
  });

  describe('返回导航', () => {
    it('点击返回按钮应该导航到个人页面', async () => {
      setupAuthMock();
      renderComponent();

      const backButton = screen.getByText('返回仪表板');
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/mypage');
    });
  });

  describe('加载状态', () => {
    it('Cognito 加载中应该显示加载指示器', () => {
      setupAuthMock({ cognitoLoading: true });
      renderComponent();

      // 应该显示加载状态
      expect(screen.getAllByText(/加载中/).length).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理 API 错误并显示错误消息', async () => {
      api.updateUserProfile.mockRejectedValue(new Error('服务器错误'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      setupAuthMock();
      renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑资料' }));
      
      // 输入用户名
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入您的显示名称')).toBeInTheDocument();
      });
      const nameInput = screen.getByPlaceholderText('请输入您的显示名称');
      await user.type(nameInput, '测试名称');

      await user.click(screen.getByRole('button', { name: /保存/ }));

      await waitFor(() => {
        // 应该显示错误通知
        expect(screen.getByText(/更新失败/)).toBeInTheDocument();
      }, { timeout: 3000 });

      consoleErrorSpy.mockRestore();
    });
  });
});
