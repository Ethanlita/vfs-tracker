/** @file 使用真实Node时区验证当地日历日，不修改主测试进程或系统时钟。 */
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {it,expect} from 'vitest';
const moduleUrl=pathToFileURL(resolve('src/utils/calendarDate.js')).href;
it.each([
 ['Asia/Shanghai','2026-09-09T17:30:00Z','2026-09-10'],
 ['UTC','2026-09-09T17:30:00Z','2026-09-09'],
 ['America/Los_Angeles','2026-09-10T02:30:00Z','2026-09-09'],
 ['Asia/Shanghai','2025-12-31T17:30:00Z','2026-01-01'],
 ['America/Los_Angeles','2026-01-01T02:30:00Z','2025-12-31'],
 ['Asia/Shanghai','2026-02-28T17:30:00Z','2026-03-01'],
 ['America/Los_Angeles','2026-03-01T02:30:00Z','2026-02-28']
])('%s在%s返回%s', (timezone,instant,expected)=>{
 const code=`import {localCalendarDate} from ${JSON.stringify(moduleUrl)};process.stdout.write(localCalendarDate(new Date(${JSON.stringify(instant)})));`;
 expect(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:timezone},encoding:'utf8'})).toBe(expected);
});
it.each(['Asia/Shanghai','UTC','America/Los_Angeles'])('%s日历日期不换日，精确时间戳保留瞬时值',timezone=>{
 const code=`import {localCalendarDate,parseEventDate} from ${JSON.stringify(moduleUrl)};process.stdout.write(JSON.stringify({day:localCalendarDate(parseEventDate('2026-09-10')),leap:localCalendarDate(parseEventDate('2024-02-29')),invalid:Number.isNaN(parseEventDate('2026-02-30').getTime()),instant:parseEventDate('2026-09-10T00:00:00.000Z').toISOString()}));`;
 expect(JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:timezone},encoding:'utf8'}))).toEqual({day:'2026-09-10',leap:'2024-02-29',invalid:true,instant:'2026-09-10T00:00:00.000Z'});
});
it('事件日期契约保留日历日期精度和时间戳原值',async()=>{
 const {eventDateString}=await import('../../../src/api/schemas.js');
 for(const value of ['2026-09-10','2026-09-10T00:00:00.000Z','2026-09-10T08:00:00+08:00']){
  const result=eventDateString.validate(value);expect(result.error).toBeUndefined();expect(result.value).toBe(value);
 }
 expect(eventDateString.validate('not-a-date').error).toBeDefined();
});
it.each(['Asia/Shanghai','UTC','America/Los_Angeles'])('%s最近日历日范围含起点、当天及当前时刻，排除未来',timezone=>{
 const code=`import {isInRecentDays} from ${JSON.stringify(moduleUrl)};const now=new Date(2026,2,1,12);process.stdout.write(JSON.stringify(['2026-01-30','2026-01-31','2026-03-01','2026-03-02',now,new Date(now.getTime()+1)].map(v=>isInRecentDays(v,30,now))));`;
 expect(JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:timezone},encoding:'utf8'}))).toEqual([false,true,true,false,true,false]);
});
