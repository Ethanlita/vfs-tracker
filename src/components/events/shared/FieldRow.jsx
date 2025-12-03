/**
 * 单行字段展示组件
 * 用于展示标签-值对
 */
import PropTypes from 'prop-types';

/**
 * 字段行组件
 * @param {Object} props - 组件属性
 * @param {string} props.label - 字段标签（中文名称）
 * @param {string|React.ReactNode} props.value - 字段值
 * @param {string} props.className - 额外的 CSS 类名
 * @param {boolean} props.highlight - 是否高亮显示
 */
const FieldRow = ({ label, value, className = '', highlight = false }) => {
  // 如果值为空，不渲染
  if (value === undefined || value === null || value === '' || value === '-') {
    return null;
  }

  return (
    <div
      className={`
        flex flex-col sm:flex-row sm:items-start py-2 
        border-b border-gray-100 dark:border-gray-700 last:border-b-0
        ${highlight ? 'bg-purple-50 dark:bg-purple-900/20 -mx-2 px-2 rounded' : ''}
        ${className}
      `}
    >
      {/* 标签 */}
      <span className="text-sm text-gray-500 dark:text-gray-400 sm:w-32 sm:flex-shrink-0 font-medium">
        {label}
      </span>
      
      {/* 值 */}
      <span className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0 sm:ml-2 break-words">
        {value}
      </span>
    </div>
  );
};

FieldRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className: PropTypes.string,
  highlight: PropTypes.bool,
};

export default FieldRow;
