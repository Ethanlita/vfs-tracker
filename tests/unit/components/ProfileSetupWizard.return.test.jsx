/** @file 资料向导成功、失败重试和主动访问的导航目标。 */
import {render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,beforeEach} from 'vitest';
import ProfileSetupWizard from '../../../src/components/ProfileSetupWizard';
const mocks=vi.hoisted(()=>({complete:vi.fn()}));
vi.mock('../../../src/contexts/AuthContext',()=>({useAuth:()=>({user:{userId:'audit-user'},completeProfileSetup:mocks.complete})}));
function CurrentPath(){const l=useLocation();return <output data-testid="path">{l.pathname+l.search+l.hash}</output>}
beforeEach(()=>{vi.clearAllMocks();mocks.complete.mockResolvedValue({})});
it.each(['skip','complete'])('通过%s出口返回完整原目标，失败不改变目标',async action=>{
 const user=userEvent.setup(),target='/event-manager?audit=return#record',url='/profile-setup-wizard?returnUrl='+encodeURIComponent(target);
 mocks.complete.mockRejectedValueOnce(new Error('保存被拒绝'));
 render(<MemoryRouter initialEntries={[url]}><ProfileSetupWizard/><CurrentPath/></MemoryRouter>);
 if(action==='complete'){await user.type(screen.getByPlaceholderText('请输入您的昵称'),'测试资料');await user.click(screen.getByRole('button',{name:'下一步'}));await user.click(screen.getByRole('button',{name:'下一步'}))}
 const label=action==='skip'?'跳过设置':'完成设置';await user.click(screen.getByRole('button',{name:label,exact:true}));await screen.findByText('保存被拒绝');expect(screen.getByTestId('path')).toHaveTextContent(url);
 await user.click(screen.getByRole('button',{name:label,exact:true}));await waitFor(()=>expect(screen.getByTestId('path').textContent).toBe(target));expect(mocks.complete).toHaveBeenCalledTimes(2);
});
it('主动打开向导没有旧目标时回个人页',async()=>{
 render(<MemoryRouter initialEntries={['/profile-setup-wizard']}><ProfileSetupWizard/><CurrentPath/></MemoryRouter>);await userEvent.click(screen.getByRole('button',{name:'跳过设置'}));await waitFor(()=>expect(screen.getByTestId('path').textContent).toBe('/mypage'));
});
