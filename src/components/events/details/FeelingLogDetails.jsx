/**
 * 感受日志详情组件
 * 展示用户的感受记录
 */
import PropTypes from 'prop-types';
import { formatDate } from '../utils/formatters';

/**
 * 感受日志详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const FeelingLogDetails = ({ event }) => {
  const { date, details = {} } = event;

  // 获取感受内容（兼容不同字段名）
  const getContent = () => {
    return details.content || details.feeling || '-';
  };

  // 获取备注
  const getNote = () => {
    return details.note || details.notes || null;
  };

  return (
    <div className="space-y-4">
      {/* 日期 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>📅</span>
        <span>{formatDate(date)}</span>
      </div>

      {/* 感受内容 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <span className="text-xl">💭</span>
          <div className="flex-1">
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {getContent()}
            </p>
          </div>
        </div>
      </div>

      {/* 备注（如果有） */}
      {getNote() && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-start gap-2">
            <span className="text-sm">📝</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getNote()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

FeelingLogDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.shape({
      content: PropTypes.string,
      feeling: PropTypes.string,
      note: PropTypes.string,
      notes: PropTypes.string,
    }),
  }).isRequired,
};

export default FeelingLogDetails;
