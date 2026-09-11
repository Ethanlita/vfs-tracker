/** @file 删除请求在途、切换详情、失败重试与卸载的交错回归。 */
import React from 'react';
import {render,screen,within,fireEvent,act,cleanup} from '@testing-library/react';
import {vi,it,expect,beforeEach,afterEach} from 'vitest';
import {minimalSelfTest} from '../../../src/test-utils/fixtures/events/self-test/minimal';
vi.mock('../../../src/api',()=>({deleteEvent:vi.fn()}));
vi.mock('../../../src/components/events/EventDetailsPanel',()=>({default:({event})=><p>{event.eventId}</p>}));
vi.mock('framer-motion',()=>({AnimatePresence:({children})=>children,motion:{div:({children,initial,animate,exit,whileHover,transition,...props})=><div {...props}>{children}</div>}}));
import {deleteEvent} from '../../../src/api';
import EventManager from '../../../src/components/EventManager';
const events=['A','B'].map(eventId=>({...minimalSelfTest,eventId}));
const card=i=>within(screen.getAllByTestId('event-item')[i]);
const open=i=>fireEvent.click(card(i).getByRole('button',{name:'查看详情'}));
let resolve,reject,done;
beforeEach(()=>{
 vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(window,'alert').mockImplementation(()=>{});
 deleteEvent.mockImplementation(()=>new Promise((yes,no)=>{resolve=yes;reject=no}));done=vi.fn();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks()});
it('取消确认不发送请求',()=>{
 window.confirm.mockReturnValue(false);render(<EventManager events={events} onEventDeleted={done}/>);
 fireEvent.click(card(0).getByRole('button',{name:'删除',exact:true}));expect(deleteEvent).not.toHaveBeenCalled();
});
it('列表与详情共享锁，重复点击只发送一次，成功只关闭自身详情',async()=>{
 render(<EventManager events={events} onEventDeleted={done}/>);
 const button=card(0).getByRole('button',{name:'删除',exact:true});fireEvent.click(button);fireEvent.click(button);open(0);
 expect(card(0).getByRole('button',{name:'删除中…'})).toBeDisabled();
 const detail=within(screen.getByTestId('event-detail'));expect(detail.getByRole('button',{name:'删除中…'})).toBeDisabled();fireEvent.click(detail.getByRole('button',{name:'删除中…'}));
 expect(deleteEvent).toHaveBeenCalledTimes(1);await act(async()=>resolve());expect(done).toHaveBeenCalledWith('A');expect(screen.queryByTestId('event-detail')).not.toBeInTheDocument();
});
it.each(['success','failure'])('删除A后关闭详情打开B，A的%s不关闭B',async(outcome)=>{
 render(<EventManager events={events} onEventDeleted={done}/>);open(0);
 fireEvent.click(within(screen.getByTestId('event-detail')).getByRole('button',{name:'删除事件'}));
 fireEvent.click(within(screen.getByTestId('event-detail')).getByRole('button',{name:'关闭',exact:true}));open(1);
 await act(async()=>outcome==='success'?resolve():reject(new Error('模拟失败')));
 expect(screen.getByTestId('event-detail')).toHaveTextContent('B');expect(done).toHaveBeenCalledTimes(outcome==='success'?1:0);
 expect(card(0).getByRole('button',{name:'删除',exact:true})).toBeEnabled();
});
it('失败保留自身详情并允许重试',async()=>{
 render(<EventManager events={events} onEventDeleted={done}/>);open(0);
 fireEvent.click(within(screen.getByTestId('event-detail')).getByRole('button',{name:'删除事件'}));await act(async()=>reject(new Error('模拟失败')));
 expect(window.alert).toHaveBeenCalledWith('删除事件失败: 模拟失败');expect(done).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByTestId('event-detail')).getByRole('button',{name:'删除事件'}));await act(async()=>resolve());expect(deleteEvent).toHaveBeenCalledTimes(2);expect(done).toHaveBeenCalledTimes(1);
});
it('离开后迟到成功不弹提示或触发旧页面回调',async()=>{
 const {unmount}=render(<EventManager events={events} onEventDeleted={done}/>);fireEvent.click(card(0).getByRole('button',{name:'删除',exact:true}));unmount();await act(async()=>resolve());expect(done).not.toHaveBeenCalled();expect(window.alert).not.toHaveBeenCalled();
});
