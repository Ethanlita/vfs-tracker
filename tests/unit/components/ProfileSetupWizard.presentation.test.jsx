/** 设置向导只展示用户资料及可见范围，不输出内部调试状态。 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import ProfileSetupWizard from '../../../src/components/ProfileSetupWizard.jsx';
vi.mock('../../../src/contexts/AuthContext',()=>({useAuth:()=>({user:{userId:'audit-user'},completeProfileSetup:vi.fn()})}));
it.each([0,1,3])('确认 %i 个账号时无调试数据且保留输入',async count=>{
 const user=userEvent.setup();render(<MemoryRouter><ProfileSetupWizard/></MemoryRouter>);
 await user.type(screen.getByPlaceholderText(/昵称/),'测试名称');await user.click(screen.getByRole('button',{name:'下一步'}));
 expect(screen.queryByText(/调试/)).not.toBeInTheDocument();
 for(let i=0;i<count;i++){await user.selectOptions(screen.getByLabelText('社交平台'),'Twitter');await user.type(screen.getByLabelText('社交账号'),'account-'+i);await user.click(screen.getByRole('button',{name:'添加',exact:true}));}
 await user.click(screen.getByRole('button',{name:'下一步'}));expect(screen.getByRole('heading',{name:'确认您的信息'})).toBeInTheDocument();expect(screen.getByText('测试名称')).toBeInTheDocument();expect(screen.queryByText(/调试|socials =|数组长度/)).not.toBeInTheDocument();
 if(!count)expect(screen.getByText('未添加社交账号')).toBeInTheDocument();else for(let i=0;i<count;i++)expect(screen.getByText('Twitter: account-'+i)).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'上一步'}));expect(screen.queryAllByRole('button',{name:'删除',exact:true}).length).toBe(count);
});
