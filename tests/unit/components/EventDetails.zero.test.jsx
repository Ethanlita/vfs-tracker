/** @file 自测/医院详情的零值、缺失与普通数值回归。 */
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {it,expect,afterEach} from 'vitest';
import {minimalSelfTest} from '../../../src/test-utils/fixtures/events/self-test/minimal';
import {eventSchemaPrivate} from '../../../src/api/schemas';
import SelfTestDetails from '../../../src/components/events/details/SelfTestDetails';
import HospitalTestDetails from '../../../src/components/events/details/HospitalTestDetails';
import {formatMetricNumber} from '../../../src/components/events/utils/formatters';
afterEach(cleanup);
for(const [type,Component] of [['self_test',SelfTestDetails],['hospital_test',HospitalTestDetails]]){
 it(type+'显示有效零值及单位',()=>{
 const event={...minimalSelfTest,type,details:{hnr:0,jitter:0,shimmer:0,...(type === 'hospital_test' ? {location:'测试医院'} : {})}};expect(eventSchemaPrivate.validate(event).error).toBeUndefined();render(<Component event={event}/>);
 for(const [label,value] of [['谐噪比 (HNR)','0.0dB'],['Jitter','0.00%'],['Shimmer','0.00%']])expect(screen.getByText(label).parentElement.parentElement).toHaveTextContent(value);
 });
 it(type+'缺失指标不伪造零值卡片',()=>{render(<Component event={{...minimalSelfTest,type,details:{}}}/>);for(const label of ['谐噪比 (HNR)','Jitter','Shimmer'])expect(screen.queryByText(label)).not.toBeInTheDocument()});
}
it('数值格式化兼容完整数字字符串，拒绝非法值',()=>{
 for(const v of [null,undefined,'',' ',false,NaN,Infinity,'3abc'])expect(formatMetricNumber(v)).toBeNull();
 expect(formatMetricNumber('0',2)).toBe('0.00');expect(formatMetricNumber(3.2,2)).toBe('3.20');expect(formatMetricNumber(-2,1)).toBe('-2.0');
});
