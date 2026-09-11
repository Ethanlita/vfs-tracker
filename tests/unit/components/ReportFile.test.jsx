/** 报告文件失败隔离、旧响应隔离与局部重试。 */
import {render,screen,fireEvent,act,waitFor} from '@testing-library/react';
import {it,expect,vi,beforeEach} from 'vitest';
import TestResultsDisplay from '../../../src/components/TestResultsDisplay.jsx';
import {resolveAttachmentUrl} from '../../../src/utils/attachments.js';
vi.mock('../../../src/utils/attachments.js',()=>({resolveAttachmentUrl:vi.fn()}));
beforeEach(()=>vi.resetAllMocks());
it.each([400,403,404,500,'offline'])('文件错误 %s 不阻塞指标和其他文件，重试只请求失败文件',async status=>{
 resolveAttachmentUrl.mockImplementation(key=>key==='bad'?Promise.reject(new Error(String(status))):Promise.resolve('https://example.test/'+key));
 render(<TestResultsDisplay results={{metrics:{spontaneous:{f0_mean:180}},charts:{good:'good'},reportPdf:'bad'}}/>);
 expect(screen.getByText(/180.0/)).toBeInTheDocument();await screen.findByRole('alert');expect(await screen.findByRole('img')).toHaveAttribute('src','https://example.test/good');expect(screen.queryByRole('link')).not.toBeInTheDocument();
 resolveAttachmentUrl.mockResolvedValueOnce('https://example.test/report.pdf');fireEvent.click(screen.getByRole('button',{name:'重试文件链接'}));expect(await screen.findByRole('link')).toHaveAttribute('href','https://example.test/report.pdf');expect(resolveAttachmentUrl.mock.calls.filter(([key])=>key==='good')).toHaveLength(1);
});
it('更换报告后迟到的旧链接不能覆盖新报告',async()=>{
 let finish;resolveAttachmentUrl.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce('https://example.test/new.pdf');
 const {rerender}=render(<TestResultsDisplay results={{metrics:{},reportPdf:'old'}}/>);rerender(<TestResultsDisplay results={{metrics:{},reportPdf:'new'}}/>);
 expect(await screen.findByRole('link')).toHaveAttribute('href','https://example.test/new.pdf');await act(async()=>finish('https://example.test/old.pdf'));expect(screen.getByRole('link')).toHaveAttribute('href','https://example.test/new.pdf');
});
it('图片加载失败提供刷新入口，快速重复重试只有一个请求',async()=>{
 resolveAttachmentUrl.mockResolvedValueOnce('https://example.test/expired.png');render(<TestResultsDisplay results={{metrics:{},charts:{pitch:'key'}}}/>);fireEvent.error(await screen.findByRole('img'));expect(screen.getByRole('alert')).toBeInTheDocument();let finish;resolveAttachmentUrl.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));const retry=screen.getByRole('button',{name:'重试文件链接'});fireEvent.click(retry);fireEvent.click(retry);expect(resolveAttachmentUrl).toHaveBeenCalledTimes(2);await act(async()=>finish('https://example.test/fresh.png'));await waitFor(()=>expect(screen.getByRole('img')).toHaveAttribute('src','https://example.test/fresh.png'));
});
