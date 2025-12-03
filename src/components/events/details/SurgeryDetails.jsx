/**
 * 手术记录详情组件
 * 展示 VFS 手术相关信息
 */
import PropTypes from 'prop-types';
import FieldRow from '../shared/FieldRow';
import { formatDate } from '../utils/formatters';

/**
 * 手术记录详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const SurgeryDetails = ({ event }) => {
  const { date, details = {} } = event;

  // 获取医生名称（处理自定义情况）
  const getDoctorName = () => {
    if (details.doctor === '自定义' && details.customDoctor) {
      return details.customDoctor;
    }
    return details.doctor || '-';
  };

  // 获取地点名称（处理自定义情况）
  const getLocationName = () => {
    if (details.location === '自定义' && details.customLocation) {
      return details.customLocation;
    }
    return details.location || '-';
  };

  return (
    <div className="space-y-4">
      {/* 手术信息卡片 */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🏥</span>
          <span className="text-base font-medium text-purple-700 dark:text-purple-300">
            手术信息
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 医生 */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">手术医生</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getDoctorName()}
            </p>
          </div>
          
          {/* 地点 */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">手术地点</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getLocationName()}
            </p>
          </div>
          
          {/* 日期 */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">手术日期</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatDate(date)}
            </p>
          </div>
        </div>
      </div>

      {/* 备注 */}
      {details.notes && (
        <div className="space-y-1">
          <FieldRow label="备注" value={details.notes} />
        </div>
      )}
    </div>
  );
};

SurgeryDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.shape({
      doctor: PropTypes.string,
      customDoctor: PropTypes.string,
      location: PropTypes.string,
      customLocation: PropTypes.string,
      notes: PropTypes.string,
    }),
  }).isRequired,
};

export default SurgeryDetails;
