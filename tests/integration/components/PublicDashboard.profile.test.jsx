/** @file 公开资料慢加载、独立重试与非公开字段对照。 */
import React from 'react';
import {render,screen,within,act,fireEvent} from '@testing-library/react';
import {vi,it,expect,beforeEach} from 'vitest';
import PublicDashboard from '../../../src/components/PublicDashboard';
import {dashboardFixture} from '../../../src/test-utils/fixtures';
import * as api from '../../../src/api';
vi.mock('../../../src/api',()=>({getPublicDashboard:vi.fn(),getPublicEventDetails:vi.fn(),getUserPublicProfile:vi.fn()}));
vi.mock('react-chartjs-2',()=>({Bar:()=>null,Line:()=>null}));
vi.mock('../../../src/components/EnhancedDataCharts',()=>({default:()=>null}));
const fixture=dashboardFixture(2);
beforeEach(()=>{vi.resetAllMocks();api.getPublicDashboard.mockResolvedValue(fixture.light);api.getPublicEventDetails.mockResolvedValue(fixture.details)});
it.each(['400','404','500','网络故障'])('%s失败可独立重试，等待与失败不隐藏资料区',async reason=>{
 let resolve,reject;api.getUserPublicProfile.mockImplementation(()=>new Promise((yes,no)=>{resolve=yes;reject=no}));
 render(<PublicDashboard/>);fireEvent.click(await screen.findByRole('button',{name:'查看档案'}));
 expect(await screen.findByText('正在加载公开资料…')).toHaveAttribute('role','status');await screen.findByText('明细 1');
 await act(async()=>reject(new Error(reason)));const profile=within(screen.getByRole('region',{name:'公开资料'}));expect(profile.getByRole('alert')).toHaveTextContent(reason);
 const retry=profile.getByRole('button',{name:'重试公开资料'});fireEvent.click(retry);fireEvent.click(retry);
 expect(api.getUserPublicProfile).toHaveBeenCalledTimes(2);await act(async()=>resolve({profile:{name:'恢复姓名',bio:'恢复简介'}}));
 expect(profile.getByText('恢复姓名')).toBeInTheDocument();expect(profile.queryByRole('alert')).not.toBeInTheDocument();
 expect(api.getPublicDashboard).toHaveBeenCalledTimes(1);expect(api.getPublicEventDetails).toHaveBeenCalledTimes(1);
});
it('非公开字段的成功响应显示正常资料而非请求错误',async()=>{
 api.getUserPublicProfile.mockResolvedValue({userId:'user1',profile:{}});render(<PublicDashboard/>);fireEvent.click(await screen.findByRole('button',{name:'查看档案'}));
 const profile=within(await screen.findByRole('region',{name:'公开资料'}));expect(await profile.findByText('（非公开）')).toBeInTheDocument();expect(profile.queryByRole('alert')).not.toBeInTheDocument();
});
it('关闭A的重试后打开B，迟到失败不能覆盖B',async()=>{
 const second=fixture.light.map(e=>({...e,userId:'user2',eventId:e.eventId+'b',userName:'用户2'}));api.getPublicDashboard.mockResolvedValue([...fixture.light,...second]);
 let reject;api.getUserPublicProfile.mockRejectedValueOnce(new Error('首次失败')).mockImplementationOnce(()=>new Promise((_,no)=>{reject=no})).mockResolvedValue({profile:{name:'用户乙资料'}});
 render(<PublicDashboard/>);fireEvent.click((await screen.findAllByRole('button',{name:'查看档案'}))[0]);fireEvent.click(await screen.findByRole('button',{name:'重试公开资料'}));
 fireEvent.click(screen.getByRole('button',{name:'关闭用户资料'}));fireEvent.click(screen.getAllByRole('button',{name:'查看档案'})[1]);await screen.findByText('用户乙资料');await act(async()=>reject(new Error('甲迟到失败')));
 expect(screen.getByText('用户乙资料')).toBeInTheDocument();expect(screen.queryByText('甲迟到失败')).not.toBeInTheDocument();
});
