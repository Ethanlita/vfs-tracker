/** @file 事件摘要边界的合法契约样本。 */
import { minimalSelfTest } from './events/self-test/minimal.js';
export const summaryEvents = [
 ['voice_training', {voiceStatus:'合成状态'}, '无训练内容'],
 ['self_practice', {hasInstructor:false}, '无练习内容'],
 ['feeling_log', {feeling:'旧版感受内容'}, '旧版感受内容'],
 ['surgery', {doctor:'自定义',customDoctor:'合成医生',location:'自定义',customLocation:'合成地点'}, '合成医生'],
 ['voice_training', {trainingContent:'短文本'}, '短文本'],
 ['self_practice', {practiceContent:'长'.repeat(51)}, '长'.repeat(50)+'…'],
].map(([type,details,summary],index)=>({event:{...minimalSelfTest,type,details,eventId:'summary-'+index},summary}));
