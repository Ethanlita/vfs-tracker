/**
 * 医院检测详情组件
 * 展示医院进行的嗓音检测结果
 * 继承 Self Test 的大部分展示逻辑，增加医院特有信息
 */
import PropTypes from 'prop-types';
import FieldRow from '../shared/FieldRow';
import { MetricCardGroup } from '../shared/MetricCard';
import CollapsibleSection from '../shared/CollapsibleSection';
import {
  formatHz,
  formatDate,
  formatArray,
} from '../utils/formatters';

/**
 * 医院检测详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const HospitalTestDetails = ({ event }) => {
  const { date, details = {} } = event;

  // 构建核心指标卡片数据
  const coreMetrics = [
    {
      label: '平均基频',
      value: details.fundamentalFrequency ? parseFloat(details.fundamentalFrequency).toFixed(1) : null,
      unit: 'Hz',
      icon: '🎵',
      color: 'purple',
    },
    {
      label: '音域范围',
      value: details.pitch ? `${parseFloat(details.pitch.min).toFixed(0)} - ${parseFloat(details.pitch.max).toFixed(0)}` : null,
      unit: 'Hz',
      icon: '📊',
      color: 'blue',
    },
    {
      label: '谐噪比 (HNR)',
      value: details.hnr && details.hnr !== '' ? parseFloat(details.hnr).toFixed(1) : null,
      unit: 'dB',
      icon: '🔊',
      color: 'green',
    },
    {
      label: 'Jitter',
      value: details.jitter ? parseFloat(details.jitter).toFixed(2) : null,
      unit: '%',
      icon: '〰️',
      color: 'orange',
    },
    {
      label: 'Shimmer',
      value: details.shimmer ? parseFloat(details.shimmer).toFixed(2) : null,
      unit: '%',
      icon: '📈',
      color: 'orange',
    },
  ];

  return (
    <div className="space-y-4">
      {/* 医院信息卡片 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🏥</span>
          <span className="text-base font-medium text-blue-700 dark:text-blue-300">
            检测信息
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 医院 */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">检测地点</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {details.location || '-'}
            </p>
          </div>
          
          {/* 设备 */}
          {details.equipmentUsed && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">使用设备</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {details.equipmentUsed}
              </p>
            </div>
          )}
          
          {/* 日期 */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">检测日期</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatDate(date)}
            </p>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <MetricCardGroup metrics={coreMetrics} />

      {/* 共振峰数据 */}
      {details.formants && (
        <CollapsibleSection title="共振峰数据" icon="📊" defaultOpen={true}>
          <div className="space-y-1">
            <FieldRow label="F1" value={formatHz(details.formants.f1)} />
            <FieldRow label="F2" value={formatHz(details.formants.f2)} />
            <FieldRow label="F3" value={formatHz(details.formants.f3)} />
          </div>
        </CollapsibleSection>
      )}

      {/* 其他信息 */}
      <CollapsibleSection title="其他信息" icon="📋">
        <div className="space-y-1">
          <FieldRow 
            label="声音状态" 
            value={Array.isArray(details.sound) ? formatArray(details.sound) : details.sound} 
          />
          {details.customSoundDetail && (
            <FieldRow label="状态详情" value={details.customSoundDetail} />
          )}
          <FieldRow 
            label="发声方式" 
            value={Array.isArray(details.voicing) ? formatArray(details.voicing) : details.voicing} 
          />
          {details.customVoicingDetail && (
            <FieldRow label="方式详情" value={details.customVoicingDetail} />
          )}
          <FieldRow label="备注" value={details.notes} />
        </div>
      </CollapsibleSection>
    </div>
  );
};

HospitalTestDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.object,
  }).isRequired,
};

export default HospitalTestDetails;
