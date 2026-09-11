/** @file 成功导航计时器必须跟随新增页面生命周期清理。 */
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';
vi.mock('../../../src/components/EventForm',()=>({default:({onEventAdded})=><button onClick={onEventAdded}>模拟已确认保存</button>}));
vi.mock('../../../src/hooks/useDocumentMeta',()=>({useDocumentMeta:()=>{}}));
import AddEvent from '../../../src/components/AddEvent';
afterEach(()=>{cleanup();vi.useRealTimers()});
/** 使用真实路由验证页面离开后不会发生旧导航。 */
function mount(){return render(<MemoryRouter initialEntries={['/add-event']}><Link to="/">首页</Link><Routes><Route path="/add-event" element={<AddEvent/>}/><Route path="/" element={<p>当前首页</p>}/><Route path="/mypage" element={<p>当前个人页</p>}/></Routes></MemoryRouter>)}
it('保存成功后留在页面，正常执行一次导航',()=>{
 vi.useFakeTimers();mount();fireEvent.click(screen.getByText('模拟已确认保存'));expect(screen.getByText('事件添加成功！即将返回仪表板...')).toBeInTheDocument();
 act(()=>vi.advanceTimersByTime(2000));expect(screen.getByText('当前个人页')).toBeInTheDocument();
});
it('成功提示出现后主动离开，取消尚未执行的导航',()=>{
 vi.useFakeTimers();mount();fireEvent.click(screen.getByText('模拟已确认保存'));fireEvent.click(screen.getByText('首页'));
 act(()=>vi.advanceTimersByTime(4000));expect(screen.getByText('当前首页')).toBeInTheDocument();expect(screen.queryByText('当前个人页')).not.toBeInTheDocument();
});
