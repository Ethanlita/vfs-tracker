/**
 * 事件详情面板组件
 * 统一入口，根据事件类型自动选择合适的详情组件
 */
import PropTypes from 'prop-types';
import SelfTestDetails from './details/SelfTestDetails';
import HospitalTestDetails from './details/HospitalTestDetails';
import SurgeryDetails from './details/SurgeryDetails';
import FeelingLogDetails from './details/FeelingLogDetails';
import VoiceTrainingDetails from './details/VoiceTrainingDetails';
import SelfPracticeDetails from './details/SelfPracticeDetails';
import AttachmentList from './shared/AttachmentList';
import { getEventTypeLabel, getStatusLabel } from './utils/fieldLabels';
import { formatDateTime } from './utils/formatters';

/**
 * 状态徽章组件
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: '⏳',
    },
    approved: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      icon: '✓',
    },
    rejected: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      icon: '✗',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span>{getStatusLabel(status)}</span>
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string,
};

/**
 * 事件类型徽章组件
 */
const TypeBadge = ({ type }) => {
  const typeConfig = {
    self_test: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: '🎤' },
    'self-test': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: '🎤' },
    hospital_test: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: '🏥' },
    surgery: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', icon: '⚕️' },
    feeling_log: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: '💭' },
    'feeling-log': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: '💭' },
    voice_training: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: '📚' },
    self_practice: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', icon: '🎯' },
  };

  const config = typeConfig[type] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', icon: '📄' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span>{getEventTypeLabel(type)}</span>
    </span>
  );
};

TypeBadge.propTypes = {
  type: PropTypes.string,
};

/**
 * 根据事件类型获取对应的详情组件
 */
const getDetailsComponent = (type) => {
  // 统一处理历史格式（带连字符）
  const normalizedType = type?.replace('-', '_') || '';
  
  switch (normalizedType) {
    case 'self_test':
      return SelfTestDetails;
    case 'hospital_test':
      return HospitalTestDetails;
    case 'surgery':
      return SurgeryDetails;
    case 'feeling_log':
      return FeelingLogDetails;
    case 'voice_training':
      return VoiceTrainingDetails;
    case 'self_practice':
      return SelfPracticeDetails;
    default:
      return null;
  }
};

/**
 * 通用详情展示（当没有专门的组件时使用）
 */
const GenericDetails = ({ event }) => {
  const { details = {} } = event;
  
  // 过滤掉复杂对象，只展示简单值
  const simpleFields = Object.entries(details).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'object' && !Array.isArray(value)) return false;
    return true;
  });

  if (simpleFields.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        暂无详细信息
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {simpleFields.map(([key, value]) => (
        <div key={key} className="flex flex-col sm:flex-row sm:items-start py-1">
          <span className="text-sm text-gray-500 dark:text-gray-400 sm:w-32 font-medium">
            {key}
          </span>
          <span className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0 sm:ml-2">
            {Array.isArray(value) ? value.join('、') : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
};

GenericDetails.propTypes = {
  event: PropTypes.object.isRequired,
};

/**
 * 事件详情面板
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 * @param {boolean} props.showHeader - 是否显示头部信息（类型、状态等）
 * @param {boolean} props.showAttachments - 是否显示附件
 * @param {boolean} props.showMetadata - 是否显示元数据（创建时间、更新时间）
 * @param {string} props.className - 额外的 CSS 类名
 */
const EventDetailsPanel = ({
  event,
  showHeader = true,
  showAttachments = true,
  showMetadata = false,
  className = '',
}) => {
  if (!event) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        请选择一个事件查看详情
      </div>
    );
  }

  const { type, status, attachments, createdAt, updatedAt } = event;
  const DetailsComponent = getDetailsComponent(type);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 头部信息 */}
      {showHeader && (
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={type} />
          <StatusBadge status={status} />
        </div>
      )}

      {/* 详情内容 */}
      <div className="min-w-0">
        {DetailsComponent ? (
          <DetailsComponent event={event} />
        ) : (
          <GenericDetails event={event} />
        )}
      </div>

      {/* 附件 */}
      {showAttachments && attachments && attachments.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <AttachmentList attachments={attachments} />
        </div>
      )}

      {/* 元数据 */}
      {showMetadata && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 space-y-1">
          {createdAt && (
            <p>创建于: {formatDateTime(createdAt)}</p>
          )}
          {updatedAt && (
            <p>更新于: {formatDateTime(updatedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
};

EventDetailsPanel.propTypes = {
  event: PropTypes.shape({
    eventId: PropTypes.string,
    type: PropTypes.string,
    status: PropTypes.string,
    date: PropTypes.string,
    details: PropTypes.object,
    attachments: PropTypes.array,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  showHeader: PropTypes.bool,
  showAttachments: PropTypes.bool,
  showMetadata: PropTypes.bool,
  className: PropTypes.string,
};

export default EventDetailsPanel;

// 导出子组件供直接使用
export { StatusBadge, TypeBadge };
