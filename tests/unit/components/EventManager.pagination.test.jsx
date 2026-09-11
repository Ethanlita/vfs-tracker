/** @file 有界分页、全量搜索及删除后页码修正。 */
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {minimalSelfTest} from '../../../src/test-utils/fixtures/events/self-test/minimal';
vi.mock('../../../src/api',()=>({deleteEvent:vi.fn()}));
import EventManager from '../../../src/components/EventManager';
afterEach(cleanup);
const events=Array.from({length:1000},(_,i)=>({...minimalSelfTest,eventId:'page-'+i,date:new Date(Date.UTC(2026,8,10-i)).toISOString(),details:{notes:'audit performance '+i}}));
it.each([25,250,1000])('%i条记录只挂载20条，搜索覆盖未显示页',async count=>{
 render(<EventManager events={events.slice(0,count)}/>);expect(screen.getAllByTestId('event-item')).toHaveLength(20);
 fireEvent.click(screen.getByRole('button',{name:'下一页',exact:true}));expect(screen.getAllByTestId('event-item')).toHaveLength(Math.min(20,count-20));
 fireEvent.change(screen.getByPlaceholderText('搜索事件...'),{target:{value:'audit performance '+(count-1)}});await waitFor(()=>expect(screen.getAllByTestId('event-item')).toHaveLength(1));
 fireEvent.change(screen.getByPlaceholderText('搜索事件...'),{target:{value:''}});await waitFor(()=>expect(screen.getByRole('button',{name:'上一页',exact:true})).toBeDisabled());expect(screen.getAllByTestId('event-item')).toHaveLength(20);
});
it('末页删除最后一条后回到有效页',async()=>{
 const {rerender}=render(<EventManager events={events.slice(0,21)}/>);fireEvent.click(screen.getByRole('button',{name:'下一页',exact:true}));expect(screen.getAllByTestId('event-item')).toHaveLength(1);
 rerender(<EventManager events={events.slice(0,20)}/>);await waitFor(()=>expect(screen.getAllByTestId('event-item')).toHaveLength(20));
});
