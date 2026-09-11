/** @file 独立指标、日期排序、零值、空态与单位的组件回归。 */
import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {metricEvents} from '../../../src/test-utils/fixtures/metric-events';
import {eventSchemaPrivate} from '../../../src/api/schemas';
vi.mock('recharts',()=>({ResponsiveContainer:({children})=><div>{children}</div>,AreaChart:()=>null,Area:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,CartesianGrid:()=>null}));
import VoiceFrequencyChart from '../../../src/components/VoiceFrequencyChart';
afterEach(cleanup);
it.each([['基频 (F0)','180','180.00','Hz'],['Jitter','1.25','2.00','%'],['Shimmer','3.2','3.20','%'],['谐噪比 (HNR)','0','5.00','dB']])('%s独立取值与乱序统计正确', (metric,latest,average,unit)=>{
 for(const event of metricEvents)expect(eventSchemaPrivate.validate(event).error).toBeUndefined();
 render(<VoiceFrequencyChart events={metricEvents}/>);fireEvent.click(screen.getByRole('button',{name:'全部',exact:true}));fireEvent.click(screen.getByRole('button',{name:metric,exact:true}));
 expect(screen.getByText('最新值').parentElement.parentElement).toHaveTextContent(latest+unit);
 expect(screen.getByText('平均值').parentElement.parentElement).toHaveTextContent(average+unit);
 expect(screen.queryByText('暂无声音参数数据')).not.toBeInTheDocument();
});
it('非有限值、缺失及空字符串不成为数据，零仍有效',()=>{
 const events=[NaN,Infinity,null,'',undefined].map((hnr,i)=>({...metricEvents[0],eventId:'invalid-'+i,details:{hnr}}));
 render(<VoiceFrequencyChart events={events}/>);fireEvent.click(screen.getByRole('button',{name:'全部',exact:true}));fireEvent.click(screen.getByRole('button',{name:'谐噪比 (HNR)',exact:true}));
 expect(screen.getByText('暂无声音参数数据')).toBeInTheDocument();
});
