/** 密码重置登录分支、过期重发及草稿保留回归测试。 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import { signIn, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import CustomAuthenticator from '../../../src/components/CustomAuthenticator.jsx';
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
/** 填写合成账号的登录表单。 */
async function login(user) {
 await user.type(screen.getByLabelText('用户名或邮箱'), 'audit-reset');
 await user.type(screen.getByLabelText('密码'), 'Example!123');
 await user.click(screen.getByRole('button',{name:'登录',exact:true}));
}
it('RESET_PASSWORD 保留用户名并要求明确发送，失败后可重试', async()=>{
 signIn.mockResolvedValueOnce({isSignedIn:false,nextStep:{signInStep:'RESET_PASSWORD'}});
 resetPassword.mockRejectedValueOnce(new Error('发送失败')).mockResolvedValueOnce({});
 const user=userEvent.setup(),success=vi.fn();render(<CustomAuthenticator>{success}</CustomAuthenticator>);
 await login(user);expect(await screen.findByLabelText('用户名')).toHaveValue('audit-reset');
 expect(screen.getByRole('status')).toHaveTextContent('需要重置密码');expect(resetPassword).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'发送验证码',exact:true}));expect(await screen.findByRole('alert')).toHaveTextContent('发送失败');
 await user.click(screen.getByRole('button',{name:'发送验证码',exact:true}));expect(await screen.findByLabelText('新密码')).toHaveValue('');
 expect(resetPassword).toHaveBeenLastCalledWith({username:'audit-reset'});expect(success).not.toHaveBeenCalled();
});
it('未知登录步骤提供明确提示且不调用登录成功回调',async()=>{
 signIn.mockResolvedValueOnce({isSignedIn:false,nextStep:{signInStep:'CONFIRM_SIGN_IN_WITH_SMS_CODE'}});
 const user=userEvent.setup(),success=vi.fn();render(<CustomAuthenticator>{success}</CustomAuthenticator>);await login(user);
 expect(await screen.findByRole('alert')).toHaveTextContent('联系管理员');expect(success).not.toHaveBeenCalled();
});
it('过期后重发失败可重试，保留密码、清除旧码、请求去重并回到登录',async()=>{
 resetPassword.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('重发失败'));
 confirmResetPassword.mockRejectedValueOnce(Object.assign(new Error('expired'),{name:'ExpiredCodeException'})).mockResolvedValueOnce({});
 const user=userEvent.setup();render(<CustomAuthenticator/>);
 await user.click(screen.getByRole('button',{name:'忘记密码？'}));await user.type(screen.getByLabelText('用户名'),'audit-reset');
 await user.click(screen.getByRole('button',{name:'发送验证码',exact:true}));
 await user.type(await screen.findByLabelText('新密码'),'NewPassword!123');await user.type(screen.getByLabelText('确认新密码'),'NewPassword!123');await user.type(screen.getByLabelText('验证码'),'111111');
 await user.click(screen.getByRole('button',{name:'重置密码',exact:true}));expect(await screen.findByRole('alert')).toHaveTextContent('验证码已过期');expect(screen.queryByRole('status')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'重新发送验证码',exact:true}));expect(await screen.findByRole('alert')).toHaveTextContent('重发失败');expect(screen.getByLabelText('新密码')).toHaveValue('NewPassword!123');
 let finish;resetPassword.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const resend=screen.getByRole('button',{name:'重新发送验证码',exact:true});fireEvent.click(resend);fireEvent.click(resend);expect(resetPassword).toHaveBeenCalledTimes(3);
 finish({});await waitFor(()=>expect(screen.getByLabelText('验证码')).toHaveValue(''));
 expect(screen.getByLabelText('新密码')).toHaveValue('NewPassword!123');expect(screen.getByRole('button',{name:/重新发送验证码/})).toBeDisabled();
 await user.type(screen.getByLabelText('验证码'),'222222');await user.click(screen.getByRole('button',{name:'重置密码',exact:true}));
 expect(await screen.findByLabelText('用户名或邮箱')).toHaveValue('audit-reset');expect(screen.getByLabelText('密码')).toHaveValue('');expect(screen.getByRole('status')).toHaveTextContent('密码重置成功');
 expect(confirmResetPassword).toHaveBeenLastCalledWith({username:'audit-reset',confirmationCode:'222222',newPassword:'NewPassword!123'});
});
