/**
 * 自我测试详情组件
 * 展示嗓音自我测试的详细分析结果，包括 full_metrics 中的复杂嵌套数据
 */
import PropTypes from 'prop-types';
import FieldRow from '../shared/FieldRow';
import { MetricCardGroup } from '../shared/MetricCard';
import CollapsibleSection from '../shared/CollapsibleSection';
import {
  formatHz,
  formatDb,
  formatDbA,
  formatPercent,
  formatSeconds,
  formatCount,
  formatDate,
  formatArray,
  formatRBH,
} from '../utils/formatters';

/**
 * 自我测试详情
 * @param {Object} props - 组件属性
 * @param {Object} props.event - 事件对象
 */
const SelfTestDetails = ({ event }) => {
  const { date, details = {} } = event;
  const fullMetrics = details.full_metrics || {};

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
      value: details.hnr ? parseFloat(details.hnr).toFixed(1) : null,
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

  // 检查是否有 full_metrics 数据
  const hasFullMetrics = Object.keys(fullMetrics).length > 0;

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{formatDate(date)}</span>
        </div>
        {details.appUsed && (
          <div className="flex items-center gap-2">
            <span>📱</span>
            <span>{details.appUsed}</span>
          </div>
        )}
      </div>

      {/* 核心指标卡片 */}
      <MetricCardGroup metrics={coreMetrics} />

      {/* 基本信息区块 */}
      <CollapsibleSection title="基本信息" icon="📋" defaultOpen={true}>
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

      {/* 共振峰数据 */}
      {details.formants && (
        <CollapsibleSection title="共振峰数据" icon="📊">
          <div className="space-y-1">
            <FieldRow label="F1" value={formatHz(details.formants.f1)} />
            <FieldRow label="F2" value={formatHz(details.formants.f2)} />
            <FieldRow label="F3" value={formatHz(details.formants.f3)} />
          </div>
        </CollapsibleSection>
      )}

      {/* 完整分析数据（如果有 full_metrics） */}
      {hasFullMetrics && (
        <CollapsibleSection title="完整分析数据" icon="🔬">
          <div className="space-y-4">
            
            {/* 持续元音测试 */}
            {fullMetrics.sustained && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>🎤</span> 持续元音测试
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <FieldRow 
                    label="基频均值" 
                    value={formatHz(fullMetrics.sustained.f0_mean)} 
                  />
                  <FieldRow 
                    label="基频标准差" 
                    value={formatHz(fullMetrics.sustained.f0_sd)} 
                  />
                  <FieldRow 
                    label="谐噪比" 
                    value={formatDb(fullMetrics.sustained.hnr_db)} 
                  />
                  <FieldRow 
                    label="声压级" 
                    value={formatDbA(fullMetrics.sustained.spl_dbA_est)} 
                  />
                  <FieldRow 
                    label="Jitter" 
                    value={formatPercent(fullMetrics.sustained.jitter_local_percent)} 
                  />
                  <FieldRow 
                    label="Shimmer" 
                    value={formatPercent(fullMetrics.sustained.shimmer_local_percent)} 
                  />
                  <FieldRow 
                    label="最长发声时间" 
                    value={formatSeconds(fullMetrics.sustained.mpt_s)} 
                  />
                </div>
                
                {/* 持续音共振峰 */}
                {fullMetrics.sustained.formants_sustained && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">持续音共振峰</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">F1: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.sustained.formants_sustained.F1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">F2: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.sustained.formants_sustained.F2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">F3: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.sustained.formants_sustained.F3)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 朗读测试 */}
            {fullMetrics.reading && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>📖</span> 朗读测试
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <FieldRow 
                    label="基频均值" 
                    value={formatHz(fullMetrics.reading.f0_mean)} 
                  />
                  <FieldRow 
                    label="基频标准差" 
                    value={formatHz(fullMetrics.reading.f0_sd)} 
                  />
                  <FieldRow 
                    label="朗读时长" 
                    value={formatSeconds(fullMetrics.reading.duration_s)} 
                  />
                  <FieldRow 
                    label="浊音比例" 
                    value={formatPercent(fullMetrics.reading.voiced_ratio)} 
                  />
                  <FieldRow 
                    label="停顿次数" 
                    value={formatCount(fullMetrics.reading.pause_count)} 
                  />
                </div>
                
                {/* 基频统计 */}
                {fullMetrics.reading.f0_stats && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">基频分布</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">P10: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.reading.f0_stats.p10)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">中位数: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.reading.f0_stats.median)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">P90: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.reading.f0_stats.p90)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 自发语音测试 */}
            {fullMetrics.spontaneous && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>💬</span> 自发语音测试
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <FieldRow 
                    label="基频均值" 
                    value={formatHz(fullMetrics.spontaneous.f0_mean)} 
                  />
                  <FieldRow 
                    label="基频标准差" 
                    value={formatHz(fullMetrics.spontaneous.f0_sd)} 
                  />
                  <FieldRow 
                    label="测试时长" 
                    value={formatSeconds(fullMetrics.spontaneous.duration_s)} 
                  />
                  <FieldRow 
                    label="浊音比例" 
                    value={formatPercent(fullMetrics.spontaneous.voiced_ratio)} 
                  />
                  <FieldRow 
                    label="停顿次数" 
                    value={formatCount(fullMetrics.spontaneous.pause_count)} 
                  />
                </div>
                
                {/* 基频统计 */}
                {fullMetrics.spontaneous.f0_stats && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">基频分布</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">P10: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.spontaneous.f0_stats.p10)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">中位数: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.spontaneous.f0_stats.median)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">P90: </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatHz(fullMetrics.spontaneous.f0_stats.p90)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 声域图 VRP */}
            {fullMetrics.vrp && !fullMetrics.vrp.error && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>📈</span> 声域图 (VRP)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最低音</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatHz(fullMetrics.vrp.f0_min)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最高音</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatHz(fullMetrics.vrp.f0_max)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最小声压</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDb(fullMetrics.vrp.spl_min)}
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-gray-900 rounded">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最大声压</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDb(fullMetrics.vrp.spl_max)}
                    </p>
                  </div>
                </div>
                
                {/* VRP bins 数据量提示 */}
                {fullMetrics.vrp.bins && fullMetrics.vrp.bins.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    包含 {fullMetrics.vrp.bins.length} 个音高-音量分布数据点
                  </p>
                )}
              </div>
            )}

            {/* 问卷结果 */}
            {fullMetrics.questionnaires && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <span>📝</span> 问卷结果
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {fullMetrics.questionnaires.RBH && (
                    <FieldRow 
                      label="RBH 评估" 
                      value={formatRBH(fullMetrics.questionnaires.RBH)} 
                    />
                  )}
                  <FieldRow 
                    label="OVHS-9 总分" 
                    value={fullMetrics.questionnaires['OVHS-9 Total']} 
                  />
                  <FieldRow 
                    label="TVQ-G 总分" 
                    value={fullMetrics.questionnaires['TVQ-G Total']} 
                  />
                  <FieldRow 
                    label="TVQ-G 百分比" 
                    value={fullMetrics.questionnaires['TVQ-G Percent']} 
                  />
                </div>
              </div>
            )}

          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

SelfTestDetails.propTypes = {
  event: PropTypes.shape({
    date: PropTypes.string,
    details: PropTypes.object,
  }).isRequired,
};

export default SelfTestDetails;
