/**
 * 嗓音训练详情组件
 * 展示嗓音训练课程信息
 */
import PropTypes from 'prop-types';
import FieldRow from '../shared/FieldRow';
import { formatDate } from '../utils/formatters';

/**
 * 嗓音训练详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const VoiceTrainingDetails = ({ event }) => {
  const { date, details = {} } = event;

  return (
    <div className="space-y-4">
      {/* 日期和指导者 */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{formatDate(date)}</span>
        </div>
        {details.instructor && (
          <div className="flex items-center gap-2">
            <span>👩‍🏫</span>
            <span>指导者: {details.instructor}</span>
          </div>
        )}
      </div>

      {/* 训练内容 */}
      {details.trainingContent && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📚</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              训练内容
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {details.trainingContent}
          </p>
        </div>
      )}

      {/* 自练作业 */}
      {details.selfPracticeContent && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📝</span>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              自练作业
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {details.selfPracticeContent}
          </p>
        </div>
      )}

      {/* 其他信息 */}
      <div className="space-y-1">
        <FieldRow label="嗓音状态" value={details.voiceStatus} />
        <FieldRow label="发声方式" value={details.voicing} />
        <FieldRow label="感受" value={details.feelings} />
        <FieldRow label="参考资料" value={details.references} />
      </div>
    </div>
  );
};

VoiceTrainingDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.shape({
      trainingContent: PropTypes.string,
      selfPracticeContent: PropTypes.string,
      voiceStatus: PropTypes.string,
      voicing: PropTypes.string,
      references: PropTypes.string,
      feelings: PropTypes.string,
      instructor: PropTypes.string,
    }),
  }).isRequired,
};

export default VoiceTrainingDetails;
