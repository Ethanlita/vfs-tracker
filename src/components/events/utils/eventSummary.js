/** @file 事件摘要和详情共享的契约字段解释。 */
/** 返回契约仍支持的感受正文，优先使用当前字段content。 */
export const feelingContent = (details = {}) => details.content || details.feeling || '';
/** 返回医生实际名称，自定义选项使用customDoctor。 */
export const doctorName = (details = {}) => details.doctor === '自定义' ? (details.customDoctor || '') : (details.doctor || '');
/** 仅在文本超过限制时添加省略号，按Unicode字符截断。 */
export function summarizeText(value, empty, limit = 50) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return empty;
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, limit).join('') + '…' : text;
}
/** 根据事件契约生成列表摘要，缺少可选字段显示明确空态。 */
export function eventSummary({ type, details = {} }) {
  switch (type) {
    case 'self_test':
    case 'hospital_test':
      return details.fundamentalFrequency != null ? `基频: ${details.fundamentalFrequency}Hz` : '无参数数据';
    case 'voice_training': return summarizeText(details.trainingContent, '无训练内容');
    case 'self_practice': return summarizeText(details.practiceContent, '无练习内容');
    case 'feeling_log': return summarizeText(feelingContent(details), '无内容');
    case 'surgery': return summarizeText(doctorName(details), '无医生信息');
    default: return '无详细信息';
  }
}

/** 列表优先展示当前契约中的备注，没有备注时展示对应类型摘要。 */
export function eventListSummary(event) {
  const notes = summarizeText(event?.details?.notes, '');
  return notes || eventSummary(event);
}
