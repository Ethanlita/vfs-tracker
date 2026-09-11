/** @file 各声音指标独立存在、乱序日期与零值的合法样本。 */
import { minimalSelfTest } from './events/self-test/minimal.js';
export const metricEvents = [
 {date:'2026-09-09',details:{jitter:1.25,shimmer:3.2,hnr:0}},
 {date:'2026-09-07',details:{jitter:2.75,hnr:10}},
 {date:'2026-09-08',details:{fundamentalFrequency:180}},
].map((fields,i)=>({...minimalSelfTest,...fields,eventId:'metric-'+i}));
