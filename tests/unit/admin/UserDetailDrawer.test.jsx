/**
 * @file UserDetailDrawer 组件测试
 * 测试管理员用户详情抽屉的权限开关与基本渲染
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserDetailDrawer from '../../../src/admin/components/UserDetailDrawer.jsx';

// Mock AWSClientContext（提供最小化的 DynamoDB/S3 客户端）
const clients = vi.hoisted(() => ({dynamoDB:{clientTag:'mock-ddb'},s3:{clientTag:'mock-s3'}}));
vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({useAWSClients:()=>({clients})}));

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

  it.each(['success','failure'])('A保存%s不能影响B，重开A保留操作结果', async outcome => {
    let resolve,reject;updateUserAdminStatus.mockImplementationOnce(()=>new Promise((a,b)=>{resolve=a;reject=b}));
    const onUserUpdate=vi.fn(),props={open:true,onClose:vi.fn(),onUserUpdate};const a={...baseUser,isAdmin:false},b={...baseUser,userId:'user-b',isAdmin:true};
    const view=render(<UserDetailDrawer {...props} user={a}/>);await userEvent.click(screen.getByRole('switch',{name:'管理员权限'}));
    view.rerender(<UserDetailDrawer {...props} user={b}/>);expect(screen.getByRole('switch')).toBeEnabled();expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
    await act(async()=>{if(outcome==='success')resolve({});else reject(new Error('拒绝'))});
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');expect(screen.queryByText('管理员权限保存失败，请重试。')).not.toBeInTheDocument();
    view.rerender(<UserDetailDrawer {...props} user={a}/>);
    if(outcome==='success'){expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');expect(onUserUpdate).toHaveBeenCalledWith({userId:a.userId,isAdmin:true})}
    else{expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false');expect(screen.getByRole('alert')).toHaveTextContent('保存失败');updateUserAdminStatus.mockResolvedValueOnce({});await userEvent.click(screen.getByText('重试保存权限'));expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true')}
  });

  it('关闭重开同一用户仍锁定在途保存，卸载后不回调父页面',async()=>{
    let resolve;updateUserAdminStatus.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const props={user:baseUser,onClose:vi.fn(),onUserUpdate:vi.fn()};
    const view=render(<UserDetailDrawer {...props} open/>);await userEvent.click(screen.getByRole('switch'));view.rerender(<UserDetailDrawer {...props} open={false}/>);view.rerender(<UserDetailDrawer {...props} open/>);
    expect(screen.getByRole('switch')).toBeDisabled();view.unmount();await act(async()=>resolve({}));expect(props.onUserUpdate).not.toHaveBeenCalled();
  });

  it.each(['success','failure'])('忽略A的迟到%s，B加载中不出现旧事件或空状态',async outcome=>{
    let resolve,reject,resolveB;queryByUserId.mockImplementationOnce(()=>new Promise((a,b)=>{resolve=a;reject=b})).mockImplementationOnce(()=>new Promise(r=>{resolveB=r}));
    const props={open:true,onClose:vi.fn()};const view=render(<UserDetailDrawer {...props} user={baseUser}/>);view.rerender(<UserDetailDrawer {...props} user={{...baseUser,userId:'user-b'}}/>);
    await act(async()=>{if(outcome==='success')resolve([{eventId:'a',type:'self_test',note:'A记录'}]);else reject(new Error('失败'))});
    expect(screen.getByRole('status',{name:'正在加载最近事件'})).toBeInTheDocument();expect(screen.queryByText('A记录')).not.toBeInTheDocument();expect(screen.queryByText('暂无事件')).not.toBeInTheDocument();
    await act(async()=>resolveB([]));expect(screen.getByText('暂无事件')).toBeInTheDocument();
  });

  it('新用户查询失败不保留旧事件，原地重试恢复成功空状态',async()=>{
    queryByUserId.mockResolvedValueOnce([{eventId:'a',type:'self_test',note:'A记录'}]).mockRejectedValueOnce(new Error('失败')).mockResolvedValueOnce([]);
    const props={open:true,onClose:vi.fn()};const view=render(<UserDetailDrawer {...props} user={baseUser}/>);await screen.findByText('A记录');view.rerender(<UserDetailDrawer {...props} user={{...baseUser,userId:'user-b'}}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('最近事件加载失败');expect(screen.queryByText('A记录')).not.toBeInTheDocument();expect(screen.queryByText('暂无事件')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('重试最近事件'));expect(await screen.findByText('暂无事件')).toBeInTheDocument();expect(queryByUserId).toHaveBeenLastCalledWith(clients.dynamoDB,'VoiceFemEvents','user-b',{limit:10});
  });

  it('B头像先完成后，迟到的A头像不能覆盖B',async()=>{
    let resolveA;getPresignedUrl.mockImplementationOnce(()=>new Promise(r=>{resolveA=r})).mockResolvedValueOnce('https://example.com/b.png');
    const a={...baseUser,profile:{...baseUser.profile,avatarKey:'a.png'}},b={...baseUser,userId:'user-b',profile:{...baseUser.profile,avatarKey:'b.png'}};
    const props={open:true,onClose:vi.fn()};const view=render(<UserDetailDrawer {...props} user={a}/>);view.rerender(<UserDetailDrawer {...props} user={b}/>);
    await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','https://example.com/b.png'));await act(async()=>resolveA('https://example.com/a.png'));expect(screen.getByRole('img')).toHaveAttribute('src','https://example.com/b.png');
  });

  it('关闭后重开同一用户，旧查询不能覆盖新的确认结果',async()=>{
    let resolve;queryByUserId.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValueOnce([]);const props={user:baseUser,onClose:vi.fn()};
    const view=render(<UserDetailDrawer {...props} open/>);view.rerender(<UserDetailDrawer {...props} open={false}/>);view.rerender(<UserDetailDrawer {...props} open/>);await screen.findByText('暂无事件');
    await act(async()=>resolve([{eventId:'old',type:'self_test',note:'旧记录'}]));expect(screen.queryByText('旧记录')).not.toBeInTheDocument();expect(screen.getByText('暂无事件')).toBeInTheDocument();
  });

  it('未选中用户且抽屉关闭时正常渲染空内容',()=>{
    const {container}=render(<UserDetailDrawer user={null} open={false} onClose={vi.fn()}/>);expect(container).toBeEmptyDOMElement();expect(queryByUserId).not.toHaveBeenCalled();
  });

  it('应该渲染权限设置区域（视觉快照）', async () => {
    // 使用 open=true 直接渲染抽屉内容
    const { container } = render(
      <UserDetailDrawer user={baseUser} open onClose={vi.fn()} onUserUpdate={vi.fn()} />
    );

    // 快照必须等待异步事件查询进入稳定空态，不能依赖全量测试时的调度速度。
    await waitFor(() => expect(screen.getByText('暂无事件')).toBeInTheDocument());

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
    expect(onUserUpdate).toHaveBeenCalledWith({ userId: baseUser.userId, isAdmin: true });
  });
});
