import React, { useState, useEffect } from 'react';
import { resolveAttachmentUrl } from '../utils/attachments.js';

const MetricCard = ({ title, value, unit }) => (
  <div className="bg-gray-100 p-4 rounded-lg text-center shadow-sm">
    <p className="text-sm text-gray-600">{title}</p>
    <p className="text-2xl font-bold text-purple-600">{value}<span className="text-lg ml-1">{unit}</span></p>
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
        // 使用 Promise.all 并行处理所有图表URL的解析
        const chartPromises = Object.entries(charts).map(async ([key, url]) => {
          const resolvedUrl = await resolveAttachmentUrl(url);
          return [key, resolvedUrl];
        });
        
        const resolvedChartEntries = await Promise.all(chartPromises);
        for (const [key, resolvedUrl] of resolvedChartEntries) {
          resolvedCharts[key] = resolvedUrl;
        }

        const resolvedPdfUrl = reportPdf ? await resolveAttachmentUrl(reportPdf) : '';

        setResolvedUrls({ charts: resolvedCharts, reportPdf: resolvedPdfUrl });
      } catch (error) {
        console.error("Error resolving attachment URLs:", error);
        // 保留原始链接作为回退
        setResolvedUrls({ charts: results.charts, reportPdf: results.reportPdf });
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

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h3 className="text-xl font-bold mb-6 text-center text-gray-800">您的嗓音分析报告</h3>

      {/* 主要指标 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <MetricCard title="平均基频 (F0)" value={metrics.sustained.f0_mean.toFixed(1)} unit="Hz" />
        <MetricCard title="最长发声时 (MPT)" value={metrics.sustained.mpt_s.toFixed(1)} unit="s" />
        <MetricCard title="谐噪比 (HNR)" value={metrics.sustained.hnr_db.toFixed(1)} unit="dB" />
        <MetricCard title="Jitter (局部)" value={metrics.sustained.jitter_local_percent.toFixed(2)} unit="%" />
        <MetricCard title="Shimmer (局部)" value={metrics.sustained.shimmer_local_percent.toFixed(2)} unit="%" />
        <MetricCard title="最低基频 (10百分位)" value={metrics.vrp.f0_min.toFixed(0)} unit="Hz" />
        <MetricCard title="最高基频 (90百分位)" value={metrics.vrp.f0_max.toFixed(0)} unit="Hz" />
      </div>

      {/* 图表预览 */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-4 text-gray-700">图表预览</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(resolvedUrls.charts).map(([key, url]) => (
            <div key={key} className="border rounded-lg p-2 shadow-sm">
              <img src={url} alt={`图表: ${key}`} className="w-full h-auto rounded" />
              <p className="text-center text-sm mt-2 text-gray-600">{key}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 下载报告 */}
      <div className="text-center">
        <a
          href={resolvedUrls.reportPdf}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 bg-green-600 text-white rounded-lg font-semibold shadow-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105"
        >
          下载完整PDF报告
        </a>
      </div>
    </div>
  );
};

export default TestResultsDisplay;
