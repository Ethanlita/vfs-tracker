/** @file 嗓音分析提交、等待、结果和失败状态界面。 */
import TestResultsDisplay from '../TestResultsDisplay';
import { ApiErrorNotice } from '../ApiErrorNotice.jsx';

/** 渲染报告生命周期，所有动作由编排 hook 注入。 */
export default function VoiceTestResultPane({ step, analysis, isUploading, onGenerate, onRetryAnalysis, onRetryQuery, onRestart }) {
  if (analysis.status === 'idle') {
    return (
      <div className="text-center space-y-4">
        <p className="mb-6">{step.instructions}</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={onGenerate} disabled={isUploading} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors">生成报告</button>
          <button onClick={onRestart} disabled={isUploading} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">重新开始测试</button>
        </div>
      </div>
    );
  }
  if (analysis.status === 'processing') {
    return <div className="text-center space-y-4"><p>{analysis.offline ? '当前离线，结果查询已暂停，联网后自动继续。' : '正在分析您的嗓音数据，请稍候... (这可能需要1-2分钟)'}</p><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" /></div>;
  }
  if (analysis.status === 'done') {
    return (
      <div className="space-y-6">
        <TestResultsDisplay results={analysis.results} />
        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={onRetryAnalysis} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors">重新生成报告</button>
          <button onClick={onRestart} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">重新开始测试</button>
        </div>
      </div>
    );
  }
  return (
    <div className="text-center space-y-4">
      {analysis.error ? <ApiErrorNotice error={analysis.error} onRetry={analysis.failureKind === 'read' ? onRetryQuery : undefined} retryLabel="继续查询结果" /> : <p className="text-red-600">分析失败，请重试。</p>}
      <div className="flex flex-wrap gap-4 justify-center">
        {analysis.failureKind !== 'expired' && <button onClick={onRetryAnalysis} className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">重试分析</button>}
        <button onClick={onRestart} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">重新开始测试</button>
      </div>
    </div>
  );
}
