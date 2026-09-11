/** @file 最近范围回归的合法事件样本，包含过去与未来记录。 */
import { minimalSelfTest } from './events/self-test/minimal.js';
import { localCalendarDate } from '../../utils/calendarDate.js';
/** 根据参考当天生成跨半年样本，避免依赖实际系统日期。 */
export function recentRangeEvents(now) {
 return [-200,-100,-60,-14,-2,1,365].map((offset,index)=>{
  const date=new Date(now);date.setDate(date.getDate()+offset);
  return {...minimalSelfTest,eventId:'event_range_'+index,date:localCalendarDate(date),details:{...minimalSelfTest.details,fundamentalFrequency:180+index*10}};
 });
}
