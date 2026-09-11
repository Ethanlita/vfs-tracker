/** @file 有限历史范围与“全部”的列表、图表统计回归。 */
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {recentRangeEvents} from '../../../src/test-utils/fixtures/recent-range';
vi.mock('../../../src/api',()=>({deleteEvent:vi.fn()}));
vi.mock('../../../src/components/events/EventDetailsPanel',()=>({default:()=>null}));
vi.mock('recharts',()=>({ResponsiveContainer:({children})=><div>{children}</div>,AreaChart:()=>null,Area:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,CartesianGrid:()=>null}));
import EventManager from '../../../src/components/EventManager';
import VoiceFrequencyChart from '../../../src/components/VoiceFrequencyChart';
let events;
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});const now=new Date(2026,8,10,12);vi.setSystemTime(now);events=recentRangeEvents(now)});
afterEach(()=>{cleanup();vi.useRealTimers()});
it('有限列表排除未来，全部仍保留记录',()=>{
 render(<EventManager events={events} onEventDeleted={()=>{}}/>);
 const range=screen.getByDisplayValue('全部时间');
 for(const [value,count] of [['1week',1],['1month',2],['3months',3],['6months',4],['all',7]]){
  fireEvent.change(range,{target:{value}});expect(screen.getAllByTestId('event-item')).toHaveLength(count);
 }
});
it('图表最新值和平均值只用选定历史范围，全部允许未来',()=>{
 render(<VoiceFrequencyChart events={events}/>);fireEvent.click(screen.getByRole('button',{name:'7天',exact:true}));
 expect(screen.getByText('最新值').parentElement.parentElement).toHaveTextContent('220');expect(screen.getByText('平均值').parentElement.parentElement).toHaveTextContent('220.00');
 fireEvent.click(screen.getByRole('button',{name:'全部',exact:true}));expect(screen.getByText('最新值').parentElement.parentElement).toHaveTextContent('240');expect(screen.getByText('平均值').parentElement.parentElement).toHaveTextContent('210.00');
});

it('有限范围无历史记录时显示空态，不借用未来记录',()=>{
 const future = events.slice(-2);
 const {unmount} = render(<EventManager events={future} onEventDeleted={()=>{}}/>);
 fireEvent.change(screen.getByDisplayValue('全部时间'),{target:{value:'1week'}});
 expect(screen.queryAllByTestId('event-item')).toHaveLength(0);
 unmount();
 render(<VoiceFrequencyChart events={future}/>);
 fireEvent.click(screen.getByRole('button',{name:'7天',exact:true}));
 expect(screen.getByText('暂无声音参数数据')).toBeInTheDocument();
});
