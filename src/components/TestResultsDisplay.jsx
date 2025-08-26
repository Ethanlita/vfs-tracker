import React, { useState, useEffect } from 'react';
import { resolveAttachmentUrl } from '../utils/attachments.js';

const MetricCard = ({ title, value, unit }) => (
  <div className="bg-gray-100 p-4 rounded-lg text-center shadow-sm">
    <p className="text-sm text-gray-600">{title}</p>
    <p className="text-2xl font-bold text-purple-600">
      {value ?? 'N/A'} 
      {value != null && unit && <span className="text-lg ml-1">{unit}</span>}
    </p>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h4 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">{title}</h4>
    <div className="p-4 bg-white rounded-lg">
      {children}
    </div>
  </div>
);

const TestResultsDisplay = ({ results }) => {
  const [resolvedUrls, setResolvedUrls] = useState({ charts: {}, reportPdf: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resolveUrls = async () => {
      if (!results || !results.metrics) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { charts, reportPdf } = results;
        
        const resolvedCharts = {};
        const chartPromises = Object.entries(charts || {}).map(async ([key, url]) => {
          const resolvedUrl = await resolveAttachmentUrl(url);
          return [key, resolvedUrl || url];
        });
        
        const resolvedChartEntries = await Promise.all(chartPromises);
        for (const [key, resolvedUrl] of resolvedChartEntries) {
          resolvedCharts[key] = resolvedUrl;
        }

        const resolvedPdfUrl = reportPdf ? (await resolveAttachmentUrl(reportPdf) || reportPdf) : '';

        setResolvedUrls({ charts: resolvedCharts, reportPdf: resolvedPdfUrl });
      } catch (error) {
        console.error("Error resolving attachment URLs:", error);
        setResolvedUrls({ charts: results.charts || {}, reportPdf: results.reportPdf || '' });
      } finally {
        setIsLoading(false);
      }
    };

    resolveUrls();
  }, [results]);

  if (!results || !results.metrics) {
    return <p>无法加载结果。</p>;
  }

  const { metrics } = results;

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <p>正在加载分析报告中的图表和文件...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
      </div>
    );
  }

  const sustained = metrics.sustained || {};
  const spontaneous = metrics.spontaneous || {}; // 新增：获取自发语音数据
  const vrp = metrics.vrp || {};
  const questionnaires = metrics.questionnaires || {};
  const isPdfReady = !!resolvedUrls.reportPdf;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <h3 className="text-2xl font-bold mb-6 text-center text-gray-800">您的嗓音分析报告</h3>

      <Section title="主要声学指标">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 修正：基频数据源来自 spontaneous 对象 */}
          <MetricCard title="平均基频 (F0)" value={spontaneous.f0_mean?.toFixed(1)} unit="Hz" />
          <MetricCard title="最长发声时 (MPT)" value={sustained.mpt_s?.toFixed(1)} unit="s" />
          <MetricCard title="谐噪比 (HNR)" value={sustained.hnr_db?.toFixed(1)} unit="dB" />
          <MetricCard title="Jitter (局部)" value={sustained.jitter_local_percent?.toFixed(2)} unit="%" />
          <MetricCard title="Shimmer (局部)" value={sustained.shimmer_local_percent?.toFixed(2)} unit="%" />
          <MetricCard title="最低基频 (10百分位)" value={vrp.f0_min?.toFixed(0)} unit="Hz" />
          <MetricCard title="最高基频 (90百分位)" value={vrp.f0_max?.toFixed(0)} unit="Hz" />
          <MetricCard title="最低声压级 (10百分位)" value={vrp.spl_min?.toFixed(1)} unit="dB" />
          <MetricCard title="最高声压级 (90百分位)" value={vrp.spl_max?.toFixed(1)} unit="dB" />
        </div>
      </Section>

      {(sustained.formants_low || sustained.formants_high) && (
        <Section title="共振峰分析">
          <div className="space-y-2 text-gray-800">
            {sustained.formants_low && (
              <div>
                <strong>最低音:</strong> F1: {sustained.formants_low.F1?.toFixed(0)} Hz, F2: {sustained.formants_low.F2?.toFixed(0)} Hz, F3: {sustained.formants_low.F3?.toFixed(0)} Hz, SPL: {sustained.formants_low.spl_dbA_est?.toFixed(1)} dB
              </div>
            )}
            {sustained.formants_high && (
              <div>
                <strong>最高音:</strong> F1: {sustained.formants_high.F1?.toFixed(0)} Hz, F2: {sustained.formants_high.F2?.toFixed(0)} Hz, F3: {sustained.formants_high.F3?.toFixed(0)} Hz, SPL: {sustained.formants_high.spl_dbA_est?.toFixed(1)} dB
              </div>
            )}
          </div>
        </Section>
      )}

      {Object.keys(questionnaires).length > 0 && (
        <Section title="主观评估量表">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {questionnaires.RBH && <MetricCard title="RBH" value={`R:${questionnaires.RBH.R} B:${questionnaires.RBH.B} H:${questionnaires.RBH.H}`} />}
            {questionnaires['OVHS-9 Total'] != null && <MetricCard title="OVHS-9" value={questionnaires['OVHS-9 Total']} unit="/ 36" />}
            {questionnaires['TVQ-G Total'] != null && <MetricCard title="TVQ-G" value={`${questionnaires['TVQ-G Total']} / 48 (${questionnaires['TVQ-G Percent']})`} />}
          </div>
        </Section>
      )}

      {Object.keys(resolvedUrls.charts).length > 0 && (
        <Section title="图表预览">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(resolvedUrls.charts).map(([key, url]) => (
              <div key={key} className="border rounded-lg p-2 shadow-sm">
                <img src={url} alt={`图表: ${key}`} className="w-full h-auto rounded" />
                <p className="text-center text-sm mt-2 text-gray-600">{key}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="text-center mt-8">
        <a
          href={isPdfReady ? resolvedUrls.reportPdf : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block px-8 py-3 rounded-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 ${
            isPdfReady 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          aria-disabled={!isPdfReady}
          onClick={(e) => !isPdfReady && e.preventDefault()}
        >
          下载完整PDF报告
        </a>
      </div>
    </div>
  );
};

export default TestResultsDisplay;
