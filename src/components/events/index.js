/**
 * 事件组件模块导出
 */

// 主入口组件
export { default as EventDetailsPanel, StatusBadge, TypeBadge } from './EventDetailsPanel';

// 详情组件
export { default as SelfTestDetails } from './details/SelfTestDetails';
export { default as HospitalTestDetails } from './details/HospitalTestDetails';
export { default as SurgeryDetails } from './details/SurgeryDetails';
export { default as FeelingLogDetails } from './details/FeelingLogDetails';
export { default as VoiceTrainingDetails } from './details/VoiceTrainingDetails';
export { default as SelfPracticeDetails } from './details/SelfPracticeDetails';

// 共享组件
export { default as FieldRow } from './shared/FieldRow';
export { default as MetricCard, MetricCardGroup } from './shared/MetricCard';
export { default as CollapsibleSection } from './shared/CollapsibleSection';
export { default as AttachmentList } from './shared/AttachmentList';

// 工具函数
export * from './utils/fieldLabels';
export * from './utils/formatters';
