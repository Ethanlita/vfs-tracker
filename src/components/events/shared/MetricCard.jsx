/**
 * 核心指标卡片组件
 * 用于突出展示关键数据指标
 */
import PropTypes from 'prop-types';

/**
 * 单个指标卡片
 * @param {Object} props - 组件属性
 * @param {string} props.label - 指标标签
 * @param {string|number} props.value - 指标值
 * @param {string} props.unit - 单位（可选）
 * @param {string} props.icon - 图标（可选，emoji 或 React 组件）
 * @param {string} props.color - 颜色主题：'purple' | 'blue' | 'green' | 'orange'
 */
const MetricCard = ({ label, value, unit = '', icon = '', color = 'purple' }) => {
  // 颜色配置
  const colorClasses = {
    purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700',
    blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
    green: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    orange: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700',
  };

  const textColorClasses = {
    purple: 'text-purple-700 dark:text-purple-300',
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
    orange: 'text-orange-700 dark:text-orange-300',
  };

  // 如果值为空，不渲染
  if (value === undefined || value === null || value === '' || value === '-') {
    return null;
  }

  return (
    <div
      className={`
        rounded-lg border p-3 
        ${colorClasses[color] || colorClasses.purple}
        transition-transform hover:scale-[1.02]
      `}
    >
      {/* 图标和标签 */}
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-base">{icon}</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {label}
        </span>
      </div>
      
      {/* 值和单位 */}
      <div className={`text-lg font-semibold ${textColorClasses[color] || textColorClasses.purple}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
};

MetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  unit: PropTypes.string,
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  color: PropTypes.oneOf(['purple', 'blue', 'green', 'orange']),
};

/**
 * 指标卡片组
 * @param {Object} props - 组件属性
 * @param {Array} props.metrics - 指标数组，每个元素包含 { label, value, unit?, icon?, color? }
 * @param {string} props.className - 额外的 CSS 类名
 */
export const MetricCardGroup = ({ metrics, className = '' }) => {
  // 过滤掉空值的指标
  const validMetrics = metrics.filter(
    m => m.value !== undefined && m.value !== null && m.value !== '' && m.value !== '-'
  );

  if (validMetrics.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ${className}`}>
      {validMetrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

MetricCardGroup.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      unit: PropTypes.string,
      icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      color: PropTypes.oneOf(['purple', 'blue', 'green', 'orange']),
    })
  ).isRequired,
  className: PropTypes.string,
};

export default MetricCard;
