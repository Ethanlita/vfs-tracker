/** @file 完整提交与重试行为：感受正文、数值0和失败恢复。 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {minimalProfileUser} from '../../../src/test-utils/fixtures';
import {ApiError} from '../../../src/utils/apiError';
const mocks=vi.hoisted(()=>({save:vi.fn(),done:vi.fn(),upload:null}));
vi.mock('../../../src/api',()=>({addEvent:mocks.save}));
vi.mock('../../../src/contexts/AuthContext.jsx',()=>({useAuth:()=>({user:minimalProfileUser})}));
vi.mock('../../../src/utils/attachments.js',()=>({resolveAttachmentLinks:async()=>[]}));
vi.mock('../../../src/components/SecureFileUpload',()=>({default:props=>{mocks.upload=props;return null}}));
import EventForm from '../../../src/components/EventForm';
beforeEach(()=>{vi.clearAllMocks();mocks.save.mockImplementation(async data=>({item:{...data,eventId:'saved'}}))});
afterEach(()=>cleanup());
function feeling(content){fireEvent.change(screen.getByLabelText(/事件类型/),{target:{value:'feeling_log'}});fireEvent.change(screen.getByPlaceholderText('记录您今天的感受...'),{target:{value:content}})}
async function submit(){await act(async()=>fireEvent.submit(screen.getByLabelText(/事件类型/).closest('form')))}
it('感受记录只填正文即可提交并触发完成回调',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);feeling('今天练习后感觉轻松');await submit();
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({type:'feeling_log',details:{content:'今天练习后感觉轻松'}}));expect(mocks.done).toHaveBeenCalledTimes(1);
});
it('纯空白正文阻止提交，重试仍进行校验',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);feeling('   ');await submit();
 expect(screen.getByRole('alert')).toHaveTextContent('请填写感受记录正文');await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重试',exact:true})));
 expect(mocks.save).not.toHaveBeenCalled();
});
it('数字0和小数保留为数字，清空字段不进入请求',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);fireEvent.click(screen.getByLabelText('好'));fireEvent.click(screen.getByLabelText('没夹'));
 for(const name of [/Jitter/,/Shimmer/,/谐噪比/]){const field=screen.getByRole('spinbutton',{name});fireEvent.change(field,{target:{value:'0'}});expect(field).toHaveValue(0)}
 fireEvent.change(screen.getByRole('spinbutton',{name:/Shimmer/}),{target:{value:'0.25'}});
 fireEvent.change(screen.getByRole('spinbutton',{name:/谐噪比/}),{target:{value:''}});await submit();
 const details=mocks.save.mock.calls[0][0].details;expect(details.jitter).toBe(0);expect(details.shimmer).toBe(.25);expect(details).not.toHaveProperty('hnr');
});
it('API失败可见，重试成功走相同完成回调',async()=>{
 mocks.save.mockRejectedValueOnce(new ApiError('服务暂不可用',{statusCode:503}));render(<EventForm onEventAdded={mocks.done}/>);feeling('正文');await submit();
 expect(screen.getByRole('alert')).toHaveTextContent('服务暂不可用');expect(mocks.done).not.toHaveBeenCalled();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重试',exact:true})));expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.done).toHaveBeenCalledTimes(1);
});
it('失败后删除自测必选项，重试不能绕过校验',async()=>{
 mocks.save.mockRejectedValueOnce(new ApiError('失败'));render(<EventForm onEventAdded={mocks.done}/>);fireEvent.click(screen.getByLabelText('好'));fireEvent.click(screen.getByLabelText('没夹'));await submit();
 fireEvent.click(screen.getByLabelText('好'));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重试',exact:true})));
 expect(mocks.save).toHaveBeenCalledTimes(1);expect(screen.getByRole('alert')).toHaveTextContent('请至少选择一项声音状态');
});
it('提交手动日期后重置为当前当地日期',async()=>{
 vi.useFakeTimers({toFake:['Date']});
 try{
  vi.setSystemTime(new Date(2026,8,10,1,30));render(<EventForm onEventAdded={mocks.done}/>);
  expect(screen.getByLabelText(/事件日期/)).toHaveValue('2026-09-10');
  fireEvent.change(screen.getByLabelText(/事件日期/),{target:{value:'2026-08-31'}});feeling('日期回归');await submit();
  expect(mocks.save.mock.calls[0][0].date).toBe('2026-08-31');
  expect(screen.getByLabelText(/事件日期/)).toHaveValue('2026-09-10');
 }finally{vi.useRealTimers()}
});

it('附件上传中和失败均阻断提交，恢复后准确包含附件',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);feeling('等待附件');
 await act(async()=>mocks.upload.onStatusChange('uploading'));await submit();expect(mocks.save).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('正在上传');
 await act(async()=>mocks.upload.onStatusChange('error'));await submit();expect(mocks.save).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('重试或放弃');
 await act(async()=>{mocks.upload.onFileUpdate('https://example.test/file','attachments/report.png',{fileType:'image/png',fileName:'report.png'});mocks.upload.onStatusChange('idle')});await submit();
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({attachments:[{fileUrl:'attachments/report.png',fileType:'image/png',fileName:'report.png'}]}));
});
it('明确放弃失败附件后允许无附件提交',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);feeling('放弃附件');await act(async()=>mocks.upload.onStatusChange('error'));await act(async()=>mocks.upload.onStatusChange('idle'));await submit();expect(mocks.save).toHaveBeenCalledTimes(1);
});

it('移除首项与中间项立即更新列表，连续旧按钮操作不会移除保留文件',async()=>{
 render(<EventForm onEventAdded={mocks.done}/>);feeling('附件删除');
 await act(async()=>{for(const name of ['A','B','C'])mocks.upload.onFileUpdate('https://example.test/'+name,'attachments/'+name+'.png',{fileType:'image/png',fileName:name+'.png'})});
 const removeA=screen.getByRole('link',{name:/A.png/}).parentElement.querySelector('button');
 await act(async()=>{fireEvent.click(removeA);fireEvent.click(removeA)});
 expect(screen.queryByRole('link',{name:/A.png/})).not.toBeInTheDocument();expect(screen.getByRole('link',{name:/B.png/})).toBeInTheDocument();expect(screen.getByRole('link',{name:/C.png/})).toBeInTheDocument();
 await act(async()=>mocks.upload.onFileUpdate('https://example.test/D','attachments/D.png',{fileType:'image/png',fileName:'D.png'}));
 fireEvent.click(screen.getByRole('link',{name:/C.png/}).parentElement.querySelector('button'));
 expect(screen.getByText('已添加附件 (2):')).toBeInTheDocument();await submit();
 expect(mocks.save.mock.calls[0][0].attachments).toEqual([{fileUrl:'attachments/B.png',fileType:'image/png',fileName:'B.png'},{fileUrl:'attachments/D.png',fileType:'image/png',fileName:'D.png'}]);
});

/** 延迟失败覆盖所有输入类型，确保解锁后仍可提交同一份草稿。 */
it('事件保存锁定文本、日期、类型、复选框及附件操作，失败解锁保留草稿',async()=>{
 const user=userEvent.setup();let reject;mocks.save.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r}));
 render(<EventForm onEventAdded={mocks.done}/>);fireEvent.click(screen.getByLabelText('好'));fireEvent.click(screen.getByLabelText('没夹'));
 const notes=screen.getAllByRole('textbox').at(-1);await user.type(notes,'提交快照');await submit();
 const group=screen.getByRole('group',{name:'事件内容'});
 for(const control of group.querySelectorAll('input,select,textarea,button'))expect(control).toBeDisabled();
 expect(mocks.upload.disabled).toBe(true);await user.type(notes,'不应接受');expect(notes).toHaveValue('提交快照');
 await act(async()=>reject(new ApiError('延迟失败')));expect(notes).toBeEnabled();expect(notes).toHaveValue('提交快照');
 await submit();expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.done).toHaveBeenCalledTimes(1);
});

it.each(['success','failure'])('离开并进入新表单后忽略旧请求的%s，不清空新草稿或调用导航',async outcome=>{
 let resolve,reject;mocks.save.mockImplementationOnce(()=>new Promise((a,b)=>{resolve=a;reject=b}));
 const old=render(<EventForm onEventAdded={mocks.done}/>);feeling('旧请求');await submit();const data=mocks.save.mock.calls[0][0];old.unmount();
 render(<EventForm onEventAdded={mocks.done}/>);feeling('新草稿');
 await act(async()=>{if(outcome==='success')resolve({item:{...data,eventId:'old-saved'}});else reject(new ApiError('迟到失败'))});
 expect(mocks.done).not.toHaveBeenCalled();expect(screen.getByPlaceholderText('记录您今天的感受...')).toHaveValue('新草稿');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
