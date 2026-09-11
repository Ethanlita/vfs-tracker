/** @file 中文目录、重复标题和异步深链接回归。 */
import React from 'react';
import {render,screen,waitFor,act,cleanup} from '@testing-library/react';
import {BrowserRouter} from 'react-router-dom';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../../../src/utils/documentation',()=>({readDocumentation:vi.fn()}));
import {readDocumentation} from '../../../src/utils/documentation';
import PostViewer from '../../../src/components/PostViewer';
let scroll,original;
beforeEach(()=>{original=Element.prototype.scrollIntoView;scroll=vi.fn();Element.prototype.scrollIntoView=scroll;window.history.replaceState({},'', '/docs?doc=test.md')});
afterEach(()=>{cleanup();Element.prototype.scrollIntoView=original;vi.clearAllMocks();window.history.replaceState({},'','/')});
it('中文标点、格式化文字与重复标题生成稳定ID',async()=>{
 readDocumentation.mockResolvedValue('# 一、常用/核心参数速查表\n\n## **重复** 标题\n\n## 重复 标题');render(<BrowserRouter><PostViewer/></BrowserRouter>);
 expect(await screen.findByRole('heading',{name:'一、常用/核心参数速查表'})).toHaveAttribute('id','一常用核心参数速查表');
 const headings=screen.getAllByRole('heading',{name:'重复 标题'});expect(headings[0]).toHaveAttribute('id','重复-标题');expect(headings[1]).toHaveAttribute('id','重复-标题-1');
});
it('带hash的链接等待正文加载后滚动并聚焦标题',async()=>{
 let resolve;readDocumentation.mockImplementation(()=>new Promise(yes=>resolve=yes));window.history.replaceState({},'', '/docs?doc=test.md#参考文献');
 render(<BrowserRouter><PostViewer/></BrowserRouter>);expect(scroll).not.toHaveBeenCalled();await act(async()=>resolve('## 参考文献\n\n正文'));
 const heading=await screen.findByRole('heading',{name:'参考文献'});await waitFor(()=>expect(heading).toHaveFocus());expect(scroll).toHaveBeenCalled();
});
it('错误编码的hash不导致正文崩溃',async()=>{
 window.history.replaceState({},'', '/docs?doc=test.md#%ZZ');readDocumentation.mockResolvedValue('## 正文');render(<BrowserRouter><PostViewer/></BrowserRouter>);expect(await screen.findByRole('heading',{name:'正文'})).toBeInTheDocument();expect(scroll).not.toHaveBeenCalled();
});
