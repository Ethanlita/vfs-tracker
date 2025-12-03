/**
 * 自我练习详情组件
 * 展示用户自我练习信息
 */
import PropTypes from 'prop-types';
import FieldRow from '../shared/FieldRow';
import { formatDate, formatBoolean } from '../utils/formatters';

/**
 * 自我练习详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const SelfPracticeDetails = ({ event }) => {
  const { date, details = {} } = event;

  return (
    <div className="space-y-4">
      {/* 日期和指导者信息 */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{formatDate(date)}</span>
        </div>
        {details.hasInstructor && details.instructor && (
          <div className="flex items-center gap-2">
            <span>👩‍🏫</span>
            <span>指导者: {details.instructor}</span>
          </div>
        )}
      </div>

      {/* 练习内容 */}
      {details.practiceContent && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎯</span>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              练习内容
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {details.practiceContent}
          </p>
        </div>
      )}

      {/* 其他信息 */}
      <div className="space-y-1">
        <FieldRow label="有指导者" value={formatBoolean(details.hasInstructor)} />
        <FieldRow label="嗓音状态" value={details.voiceStatus} />
        <FieldRow label="发声方式" value={details.voicing} />
        <FieldRow label="感受" value={details.feelings} />
        <FieldRow label="参考资料" value={details.references} />
      </div>
    </div>
  );
};

SelfPracticeDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.shape({
      practiceContent: PropTypes.string,
      hasInstructor: PropTypes.bool,
      instructor: PropTypes.string,
      voiceStatus: PropTypes.string,
      voicing: PropTypes.string,
      references: PropTypes.string,
      feelings: PropTypes.string,
    }),
  }).isRequired,
};

export default SelfPracticeDetails;
