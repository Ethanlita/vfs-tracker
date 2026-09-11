/**
 * @file UserProfileManager 组件集成测试
 * @description 测试用户资料管理组件的编辑、保存、头像更新等功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import UserProfileManager from '../../../src/components/UserProfileManager';
import * as avatarUtils from '../../../src/utils/avatar';

// Mock 头像工具模块
vi.mock('../../../src/utils/avatar');

// Mock useAuth hook
const mockUseAuth = vi.fn();
const mockUpdateUserProfile = vi.fn();
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

const mockPendingEmailVerification = {
  ownerUserId: 'test-user-123',
  email: 'new@example.com',
  previousEmail: 'test@example.com',
  destination: 'n***@example.com',
  deliveryMedium: 'EMAIL',
  createdAt: '2026-09-11T00:00:00.000Z',
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
      updateUserProfile: mockUpdateUserProfile,
      cognitoUserInfo: mockCognitoUserInfo,
      cognitoLoading: false,
      updateCognitoUserInfo: vi.fn(),
      refreshCognitoUserInfo: vi.fn(),
      pendingEmailVerification: null,
      resendEmailVerification: vi.fn(),
      confirmEmailVerification: vi.fn(),
      cancelEmailChange: vi.fn(),
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


  describe('资料草稿生命周期（#154）', () => {
    it('头像刷新保留未保存的名称、公开选项、社交账号及待添加内容', async () => {
      const view = renderComponent();
      await user.click(screen.getByRole('button', {name:'编辑资料'}));
      const name = screen.getByPlaceholderText('请输入您的显示名称');
      await user.clear(name); await user.type(name, '未保存名称');
      await user.click(screen.getByLabelText('在公共页面显示我的名称'));
      await user.selectOptions(screen.getByLabelText('社交平台'), 'QQ');
      await user.type(screen.getByLabelText('社交账号', {exact:true}), 'draft-account');
      await user.click(screen.getByRole('button', {name:'添加', exact:true}));
      await user.type(screen.getByLabelText('社交账号', {exact:true}), 'still-typing');
      setupAuthMock({userProfile:{...mockUserProfile, profile:{...mockUserProfile.profile, avatarKey:'new.png'}}});
      view.rerender(<BrowserRouter><UserProfileManager /></BrowserRouter>);
      expect(name).toHaveValue('未保存名称');
      expect(screen.getByLabelText('在公共页面显示我的名称')).not.toBeChecked();
      expect(screen.getByText('draft-account')).toBeInTheDocument();
      expect(screen.getByLabelText('社交账号', {exact:true})).toHaveValue('still-typing');
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
    it('延迟失败时锁定所有资料操作，失败后保留输入并允许重试', async () => {
      let reject; mockUpdateUserProfile.mockImplementationOnce(() => new Promise((_, r) => {reject=r}));
      renderComponent(); await user.click(screen.getByRole('button', {name:'编辑资料'}));
      const name=screen.getByPlaceholderText('请输入您的显示名称');
      await user.clear(name); await user.type(name,'保存快照');
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      const group=screen.getByRole('group',{name:'个人资料'});
      for(const control of group.querySelectorAll('input,select,button')) expect(control).toBeDisabled();
      await user.type(name,'不能输入'); expect(name).toHaveValue('保存快照');
      await act(async()=>reject(new Error('延迟保存失败')));
      expect(name).toBeEnabled(); expect(name).toHaveValue('保存快照');
      mockUpdateUserProfile.mockResolvedValueOnce({});
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(await screen.findByText('个人资料更新成功！')).toBeInTheDocument();
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(2);
    });
    it('账户切换销毁原用户的编辑草稿', async () => {
      const view=renderComponent(); await user.click(screen.getByRole('button',{name:'编辑资料'}));
      await user.type(screen.getByPlaceholderText('请输入您的显示名称'),'旧草稿');
      setupAuthMock({user:{...mockUser,userId:'another-user'},userProfile:{...mockUserProfile,profile:{...mockUserProfile.profile,name:'另一用户'}}});
      view.rerender(<BrowserRouter><UserProfileManager /></BrowserRouter>);
      expect(screen.queryByPlaceholderText('请输入您的显示名称')).not.toBeInTheDocument();
      expect(screen.getByText('另一用户')).toBeInTheDocument();
    });
  });

  describe('改密意图完整性（#122）', () => {
    it.each([
      ['', 'New!123456', 'New!123456', '当前密码', '请填写当前密码'],
      ['Old!123456', '', '', '新密码', '请填写新密码'],
      ['Old!123456', 'New!123456', '', '确认新密码', '请填写确认新密码'],
      ['Old!123456', 'New!123456', 'Different!123', '确认新密码', '新密码和确认密码不匹配']
    ])('阻止不完整改密并保留输入：%s / %s / %s', async (current, next, confirm, focus, error) => {
      const update = vi.fn(); setupAuthMock({ updateCognitoUserInfo: update }); renderComponent();
      await user.click(screen.getByRole('button', {name:'编辑账户'}));
      for (const [label,value] of [['当前密码',current],['新密码',next],['确认新密码',confirm]]) {
        if(value) await user.type(screen.getByLabelText(label),value);
      }
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(screen.getByText(error)).toHaveAttribute('role','alert');
      expect(screen.getByLabelText(focus)).toHaveFocus();
      expect(screen.getByLabelText('新密码')).toHaveValue(next);
      expect(update).not.toHaveBeenCalled();
    });
    it('无修改不请求、不退出编辑；三个密码留空仍可只改昵称',async()=>{
      const update=vi.fn().mockResolvedValue({success:true,message:'账户信息更新成功！'});
      setupAuthMock({updateCognitoUserInfo:update});renderComponent();
      await user.click(screen.getByRole('button',{name:'编辑账户'}));
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(screen.getByText('没有需要保存的账户修改。')).toBeInTheDocument();expect(update).not.toHaveBeenCalled();
      await user.type(screen.getByPlaceholderText('请输入昵称'),'新');
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(update).toHaveBeenCalledWith({nickname:'测试昵称新'});
    });
    it('完整改密发送准确参数，服务拒绝后保留输入并可重试成功',async()=>{
      const update=vi.fn().mockRejectedValueOnce(new Error('当前密码错误')).mockResolvedValueOnce({success:true,message:'密码更新成功'});
      setupAuthMock({updateCognitoUserInfo:update});renderComponent();
      await user.click(screen.getByRole('button',{name:'编辑账户'}));
      await user.type(screen.getByLabelText('当前密码'),'Old!123456');
      await user.type(screen.getByLabelText('新密码'),'New!123456');
      await user.type(screen.getByLabelText('确认新密码'),'New!123456');
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(await screen.findByText('更新失败，请重试')).toBeInTheDocument();expect(screen.getByLabelText('新密码')).toHaveValue('New!123456');
      await user.click(screen.getByRole('button',{name:'保存',exact:true}));
      expect(update).toHaveBeenLastCalledWith({currentPassword:'Old!123456',password:'New!123456'});
      expect(await screen.findByRole('button',{name:'编辑账户'})).toBeInTheDocument();
    });
  });

  describe('账户部分成功恢复（#125）', () => {
    it('昵称已保存但改密失败时显示准确警告，保留密码并只重试改密', async () => {
      const update = vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          partialSuccess: true,
          message: '昵称已保存，但密码修改失败，请检查当前密码后重试。',
        })
        .mockResolvedValueOnce({ success: true, message: '密码更新成功！' });
      setupAuthMock({ updateCognitoUserInfo: update });
      const view = renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑账户' }));
      const nickname = screen.getByPlaceholderText('请输入昵称');
      await user.clear(nickname);
      await user.type(nickname, '已保存的新昵称');
      await user.type(screen.getByLabelText('当前密码'), 'Old!123456');
      await user.type(screen.getByLabelText('新密码'), 'New!123456');
      await user.type(screen.getByLabelText('确认新密码'), 'New!123456');
      await user.click(screen.getByRole('button', { name: '保存', exact: true }));

      expect(await screen.findByRole('status')).toHaveTextContent('昵称已保存，但密码修改失败');
      expect(screen.getByLabelText('新密码')).toHaveValue('New!123456');

      setupAuthMock({
        updateCognitoUserInfo: update,
        cognitoUserInfo: { ...mockCognitoUserInfo, nickname: '已保存的新昵称' },
      });
      view.rerender(<BrowserRouter><UserProfileManager /></BrowserRouter>);
      await user.click(screen.getByRole('button', { name: '保存', exact: true }));

      expect(update).toHaveBeenNthCalledWith(1, {
        nickname: '已保存的新昵称',
        currentPassword: 'Old!123456',
        password: 'New!123456',
      });
      expect(update).toHaveBeenNthCalledWith(2, {
        currentPassword: 'Old!123456',
        password: 'New!123456',
      });
      expect(await screen.findByText('密码更新成功！')).toBeInTheDocument();
    });

    it('部分成功后取消时显示 Cognito 重读的新昵称', async () => {
      const update = vi.fn().mockResolvedValue({
        success: false,
        partialSuccess: true,
        message: '昵称已保存，但密码修改失败，请检查当前密码后重试。',
      });
      setupAuthMock({ updateCognitoUserInfo: update });
      const view = renderComponent();

      await user.click(screen.getByRole('button', { name: '编辑账户' }));
      await user.clear(screen.getByPlaceholderText('请输入昵称'));
      await user.type(screen.getByPlaceholderText('请输入昵称'), '已保存的新昵称');
      await user.type(screen.getByLabelText('当前密码'), 'Old!123456');
      await user.type(screen.getByLabelText('新密码'), 'New!123456');
      await user.type(screen.getByLabelText('确认新密码'), 'New!123456');
      await user.click(screen.getByRole('button', { name: '保存', exact: true }));
      await screen.findByRole('status');

      setupAuthMock({
        updateCognitoUserInfo: update,
        cognitoUserInfo: { ...mockCognitoUserInfo, nickname: '已保存的新昵称' },
      });
      view.rerender(<BrowserRouter><UserProfileManager /></BrowserRouter>);
      await user.click(screen.getByRole('button', { name: '取消' }));

      expect(screen.getByText('已保存的新昵称')).toBeInTheDocument();
      expect(screen.queryByText('测试昵称')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
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
    it('保存应该通过统一服务器状态更新资料且不发起二次读取', async () => {
      mockUpdateUserProfile.mockResolvedValue({ success: true });
      setupAuthMock();
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
        expect(mockUpdateUserProfile).toHaveBeenCalled();
        // 账号由 AuthContext 绑定，组件只提交资料补丁。
        const callArgs = mockUpdateUserProfile.mock.calls[0];
        expect(callArgs[0].profile.name).toContain('新用户名');
      }, { timeout: 3000 });
    });

    it('保存成功应该退出编辑模式', async () => {
      mockUpdateUserProfile.mockResolvedValue({ success: true });
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
      mockUpdateUserProfile.mockRejectedValue(new Error('网络错误'));

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

    it('邮箱待验证时显示目标、原邮箱和验证码入口，不误报最终成功', async () => {
      setupAuthMock({ pendingEmailVerification: mockPendingEmailVerification });
      renderComponent();

      expect(screen.getByText('新邮箱待验证')).toBeInTheDocument();
      expect(screen.getByText('new@example.com')).toBeInTheDocument();
      expect(screen.getByText(/账户仍使用原邮箱 test@example.com/)).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱验证码')).toHaveAttribute('autocomplete', 'one-time-code');
      expect(screen.queryByText('新邮箱验证成功，邮箱更换已完成。')).not.toBeInTheDocument();
    });

    it('确认验证码保留失败输入，并针对错误、过期及限速给出可操作提示', async () => {
      const confirm = vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('bad code'), { name: 'CodeMismatchException' }))
        .mockRejectedValueOnce(Object.assign(new Error('expired'), { name: 'ExpiredCodeException' }))
        .mockRejectedValueOnce(Object.assign(new Error('limited'), { name: 'LimitExceededException' }))
        .mockResolvedValueOnce({ success: true, message: '新邮箱验证成功，邮箱更换已完成。' });
      setupAuthMock({ pendingEmailVerification: mockPendingEmailVerification, confirmEmailVerification: confirm });
      renderComponent();
      const code = screen.getByLabelText('邮箱验证码');

      await user.click(screen.getByRole('button', { name: '确认验证码' }));
      expect(screen.getByText('请输入邮箱中的验证码。')).toBeInTheDocument();
      expect(code).toHaveFocus();

      await user.type(code, '111111');
      await user.click(screen.getByRole('button', { name: '确认验证码' }));
      expect(await screen.findByText('验证码不正确，请检查后重新输入。')).toBeInTheDocument();
      expect(code).toHaveValue('111111');

      await user.click(screen.getByRole('button', { name: '确认验证码' }));
      expect(await screen.findByText('验证码已过期，请重新发送后输入新验证码。')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '确认验证码' }));
      expect(await screen.findByText('请求过于频繁，请稍后再试。')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '确认验证码' }));
      expect(await screen.findByText('新邮箱验证成功，邮箱更换已完成。')).toBeInTheDocument();
      expect(confirm).toHaveBeenLastCalledWith('111111');
    });

    it('重发使用属性验证码操作并清空旧码，且可取消或改填地址', async () => {
      const resend = vi.fn().mockResolvedValue({ success: true, message: '新的邮箱验证码已发送，请检查收件箱。' });
      const cancel = vi.fn().mockResolvedValue({ success: true, message: '邮箱更换已取消。' });
      setupAuthMock({
        pendingEmailVerification: mockPendingEmailVerification,
        resendEmailVerification: resend,
        cancelEmailChange: cancel,
      });
      renderComponent();
      const code = screen.getByLabelText('邮箱验证码');
      await user.type(code, '123456');
      await user.click(screen.getByRole('button', { name: '重新发送验证码' }));
      expect(resend).toHaveBeenCalledTimes(1);
      expect(code).toHaveValue('');

      await user.click(screen.getByRole('button', { name: '更改邮箱地址' }));
      expect(screen.getByLabelText('邮箱地址')).toHaveValue('new@example.com');
      await user.click(screen.getByRole('button', { name: '取消' }));
      await user.click(screen.getByRole('button', { name: '取消更换邮箱' }));
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('邮箱更换已取消。')).toBeInTheDocument();
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
      mockUpdateUserProfile.mockRejectedValue(new Error('服务器错误'));

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
