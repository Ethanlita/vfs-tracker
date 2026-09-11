/** @file 登录等待资料状态就绪，只使用统一出口导航。 */
import {render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,Routes,Route} from 'react-router-dom';
import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:{},success:vi.fn()}));
vi.mock('../../../src/contexts/AuthContext',()=>({useAuth:()=>m.auth}));
vi.mock('../../../src/hooks/useDocumentMeta',()=>({useDocumentMeta:()=>{}}));
vi.mock('aws-amplify',()=>({Amplify:{getConfig:()=>({Auth:{Cognito:{userPoolId:'test'}}})}}));
vi.mock('@aws-amplify/ui-react',()=>({Authenticator:()=>null,translations:{}}));
vi.mock('../../../src/components/CustomAuthenticator',async()=>{const {useEffect,useRef}=await import('react');function MockCustomAuthenticator({children}){const childrenRef=useRef(children);childrenRef.current=children;useEffect(()=>{childrenRef.current({user:{userId:'a'}})},[]);return null}return {default:MockCustomAuthenticator}});
import LoginPage from '../../../src/components/LoginPage';
function Page(){const l=useLocation();return <><Routes><Route path="/login" element={<LoginPage/>}/><Route path="*" element={null}/></Routes><output data-testid="path">{l.pathname+l.search+l.hash}</output></>}
beforeEach(()=>{vi.clearAllMocks();m.auth={user:{userId:'a'},isAuthenticated:true,authInitialized:true,profileLoading:false,needsProfileSetup:false,handleAuthSuccess:m.success}});
it.each([false,true])('资料加载完成后才选择向导或目标：%s',async needs=>{
 m.auth={...m.auth,profileLoading:true,needsProfileSetup:needs};const entry='/login?returnUrl='+encodeURIComponent('/event-manager?audit=return#record');
 const view=render(<MemoryRouter initialEntries={[entry]}><Page/></MemoryRouter>);await waitFor(()=>expect(m.success).toHaveBeenCalledTimes(1));expect(screen.getByTestId('path').textContent).toBe(entry);
 m.auth={...m.auth,profileLoading:false};view.rerender(<MemoryRouter initialEntries={[entry]}><Page/></MemoryRouter>);
 const expected=needs?'/profile-setup-wizard?returnUrl='+encodeURIComponent('/event-manager?audit=return#record'):'/event-manager?audit=return#record';await waitFor(()=>expect(screen.getByTestId('path').textContent).toBe(expected));expect(m.success).toHaveBeenCalledTimes(1);
});
it('资料向导不能打断本地计算工具',async()=>{
 m.auth.needsProfileSetup=true;render(<MemoryRouter initialEntries={['/login?returnUrl=%2Fquick-f0-test']}><Page/></MemoryRouter>);await waitFor(()=>expect(screen.getByTestId('path').textContent).toBe('/quick-f0-test'));
});
