/** 临时密码挑战必填属性及未完成认证的回归测试。 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import { signIn, confirmSignIn, getCurrentUser } from 'aws-amplify/auth';
import CustomAuthenticator from '../../../src/components/CustomAuthenticator.jsx';
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
/** 用模拟 nextStep 进入临时密码挑战。 */
async function enter(attributes=[]){
 signIn.mockResolvedValueOnce({isSignedIn:false,nextStep:{signInStep:'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED',missingAttributes:attributes}});
 const user=userEvent.setup(),success=vi.fn();render(<CustomAuthenticator>{success}</CustomAuthenticator>);
 await user.type(screen.getByLabelText('用户名或邮箱'),'audit-temp');await user.type(screen.getByLabelText('密码'),'Temporary!123');await user.click(screen.getByRole('button',{name:'登录',exact:true}));
 await user.type(await screen.findByLabelText('新密码'),'NewPassword!123');await user.type(screen.getByLabelText('确认新密码'),'NewPassword!123');return {user,success};
}
it('只呈现缺失属性，空值拦截，失败保留并可提交成功',async()=>{
 const {user,success}=await enter(['nickname','email']);
 fireEvent.submit(screen.getByLabelText('新密码').closest('form'));
 expect(await screen.findByRole('alert')).toHaveTextContent('请填写昵称');expect(confirmSignIn).not.toHaveBeenCalled();
 await user.type(screen.getByLabelText('昵称'),' 测试昵称 ');await user.type(screen.getByLabelText('邮箱'),'audit@example.test');
 confirmSignIn.mockRejectedValueOnce(new Error('服务失败')).mockResolvedValueOnce({isSignedIn:true,nextStep:{signInStep:'DONE'}});
 await user.click(screen.getByRole('button',{name:'设置新密码并登录'}));expect(await screen.findByRole('alert')).toHaveTextContent('服务失败');expect(screen.getByLabelText('昵称')).toHaveValue(' 测试昵称 ');
 await user.click(screen.getByRole('button',{name:'设置新密码并登录'}));expect(confirmSignIn).toHaveBeenLastCalledWith({challengeResponse:'NewPassword!123',options:{userAttributes:{nickname:'测试昵称',email:'audit@example.test'}}});expect(success).toHaveBeenCalledTimes(1);
});
it('无缺失属性不附加属性，后续验证未完成不获取用户或登录',async()=>{
 const {user,success}=await enter();confirmSignIn.mockResolvedValueOnce({isSignedIn:false,nextStep:{signInStep:'CONFIRM_SIGN_IN_WITH_SMS_CODE'}});
 await user.click(screen.getByRole('button',{name:'设置新密码并登录'}));expect(await screen.findByRole('alert')).toHaveTextContent('还需要额外验证');expect(confirmSignIn).toHaveBeenCalledWith({challengeResponse:'NewPassword!123'});expect(getCurrentUser).not.toHaveBeenCalled();expect(success).not.toHaveBeenCalled();
});
it('挑战过期可返回登录，保留用户名并清空密码',async()=>{
 const {user}=await enter(['nickname']);await user.type(screen.getByLabelText('昵称'),'测试昵称');confirmSignIn.mockRejectedValueOnce(Object.assign(new Error('expired'),{name:'NotAuthorizedException'}));
 await user.click(screen.getByRole('button',{name:'设置新密码并登录'}));expect(await screen.findByRole('alert')).toHaveTextContent('验证已失效');await user.click(screen.getByRole('button',{name:'返回登录'}));expect(screen.getByLabelText('用户名或邮箱')).toHaveValue('audit-temp');expect(screen.getByLabelText('密码')).toHaveValue('');
});
