/** @file 离线事件发送前核对实际凭证归属，账号变化时不得发出POST。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalSelfTest } from '../../src/test-utils/fixtures/index.js';
import { AuthenticationError } from '../../src/utils/apiError.js';
const mocks = vi.hoisted(() => ({ session: vi.fn(), post: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.session }));
vi.mock('aws-amplify/api', () => ({ post: mocks.post, get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../../src/utils/timeout.js', () => ({ withAutoTimeout: async () => ({eventId:'created'}), isTimeoutError: () => false }));
import { addEvent } from '../../src/api.js';
const eventData = { type: minimalSelfTest.type, date: minimalSelfTest.date, details: minimalSelfTest.details };
/** 仅构造测试凭证的载荷；不用于真实认证。 */
const token = sub => 'header.' + btoa(JSON.stringify({sub})) + '.synthetic';
beforeEach(() => { vi.clearAllMocks(); });

describe('addEvent expectedUserId', () => {
  it('重试时原样传递调用方的稳定标识', async () => {
    mocks.session.mockResolvedValue({tokens:{idToken:token(minimalSelfTest.userId)}});
    const options={expectedUserId:minimalSelfTest.userId,clientRequestId:'stable-request'};
    await addEvent(eventData,options);await addEvent(eventData,options);
    expect(mocks.post.mock.calls.map(call=>call[0].options.body.clientRequestId)).toEqual(['stable-request','stable-request']);
  });
  it.each(['object','string'])('凭证匹配时发送同一份%s凭证', async shape => {
    const raw = token(minimalSelfTest.userId);
    mocks.session.mockResolvedValue({tokens:{idToken:shape==='string'?raw:{payload:{sub:minimalSelfTest.userId},toString:()=>raw}}});
    await addEvent(eventData,{expectedUserId:minimalSelfTest.userId});
    expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({body:eventData,headers:expect.objectContaining({Authorization:'Bearer '+raw})})}));
  });

  it.each(['other-account',null])('凭证账号为%s时拒绝提交原账号记录', async sub => {
    mocks.session.mockResolvedValue({tokens:{idToken:token(sub)}});
    await expect(addEvent(eventData,{expectedUserId:minimalSelfTest.userId})).rejects.toThrow(AuthenticationError);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('会话读取等待期间切换账号也拒绝发送', async () => {
    let release;
    mocks.session.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
    const request=addEvent(eventData,{expectedUserId:minimalSelfTest.userId});
    const assertion=expect(request).rejects.toThrow(AuthenticationError);
    release({tokens:{idToken:token('other-account')}});
    await assertion;
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('无法解析凭证时不猜测账号', async () => {
    mocks.session.mockResolvedValue({tokens:{idToken:'invalid'}});
    await expect(addEvent(eventData,{expectedUserId:minimalSelfTest.userId})).rejects.toThrow(AuthenticationError);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
