/** @file 摘要契约、详情一致性与截断边界。 */
import {it,expect} from 'vitest';
import {summaryEvents} from '../../../src/test-utils/fixtures/event-summary';
import {eventSchemaPrivate} from '../../../src/api/schemas';
import {eventSummary,summarizeText,feelingContent,doctorName} from '../../../src/components/events/utils/eventSummary';
it.each(summaryEvents)('合法事件$event.eventId显示摘要$summary',({event,summary})=>{
 expect(eventSchemaPrivate.validate(event).error).toBeUndefined();expect(eventSummary(event)).toBe(summary);
});
it('边界文本不添加省略号，并保持Unicode完整',()=>{
 expect(summarizeText('字'.repeat(50),'空')).toBe('字'.repeat(50));expect(summarizeText('😀'.repeat(51),'空')).toBe('😀'.repeat(50)+'…');expect(summarizeText('   ','空')).toBe('空');
});
it('详情和摘要使用同一契约解释，当前正文优先于旧字段',()=>{
 expect(feelingContent({content:'当前',feeling:'旧版'})).toBe('当前');expect(doctorName({doctor:'自定义',customDoctor:'合成医生'})).toBe('合成医生');
});
