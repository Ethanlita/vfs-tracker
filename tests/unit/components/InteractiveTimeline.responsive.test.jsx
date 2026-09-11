/** @file 时间轴只挂载当前布局和当前页，调整宽度保留页码与详情。 */
import React from 'react';
import {render,screen,fireEvent,act,cleanup,waitFor} from '@testing-library/react';
import {it,expect,afterEach} from 'vitest';
import {minimalSelfTest} from '../../../src/test-utils/fixtures/events/self-test/minimal';
import InteractiveTimeline from '../../../src/components/InteractiveTimeline';
const width=window.innerWidth;
afterEach(()=>{cleanup();window.innerWidth=width});
const events=Array.from({length:1000},(_,i)=>({...minimalSelfTest,eventId:'timeline-'+i,date:new Date(Date.UTC(2020,0,1+i)).toISOString(),details:{notes:'记录'+i}}));
it.each([25,250,1000])('%i条历史只挂载10条，宽度切换保留页码',async count=>{
 window.innerWidth=390;render(<InteractiveTimeline events={events.slice(0,count)}/>);
 expect(screen.getAllByTestId('timeline-event')).toHaveLength(10);expect(screen.queryByTestId('timeline-desktop')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'下一页',exact:true}));expect(screen.getByText('记录10')).toBeInTheDocument();
 act(()=>{window.innerWidth=1440;window.dispatchEvent(new Event('resize'))});
 expect(screen.queryByTestId('timeline-mobile')).not.toBeInTheDocument();expect(screen.getAllByTestId('timeline-event')).toHaveLength(10);expect(screen.getByText('记录10')).toBeInTheDocument();
 fireEvent.click(screen.getByText('记录10'));expect(await screen.findByRole('dialog',{name:'时间轴事件详情'})).toHaveTextContent('记录10');
 act(()=>{window.innerWidth=390;window.dispatchEvent(new Event('resize'))});expect(screen.getByRole('dialog')).toHaveTextContent('记录10');fireEvent.click(screen.getByRole('button',{name:'关闭',exact:true}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('末页不足10条时准确显示且没有隐藏副本',()=>{
 window.innerWidth=1440;render(<InteractiveTimeline events={events.slice(0,25)}/>);fireEvent.click(screen.getByRole('button',{name:'第 3 页'}));expect(screen.getAllByTestId('timeline-event')).toHaveLength(5);expect(screen.getByText('记录24')).toBeInTheDocument();
});
