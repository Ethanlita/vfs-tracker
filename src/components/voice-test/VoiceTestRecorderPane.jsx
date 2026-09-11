/** @file 录音步骤界面：稿件、进度、上传恢复与本地回放。 */
import Recorder from '../Recorder';
import ReadingPassagePanel from '../ReadingPassagePanel';
import { ApiErrorNotice } from '../ApiErrorNotice.jsx';
import { VOICE_TEST_STEPS } from '../../voice-test/voiceTestSteps.js';

/** 渲染一个录音步骤；录音和上传副作用全部由外部 hook 处理。 */
export default function VoiceTestRecorderPane({
  step,
  recordings,
  reading,
  upload,
  playback,
  onRecordingComplete,
  onRestart,
  onGoToPending,
}) {
  const allDone = recordings.length >= (step.recordingsNeeded || 0);
  const pendingStep = upload.pendingRecording?.stepId;
  const ownsPending = pendingStep === step.id;
  return (
    <div className="text-center w-full">
      <p className="mb-4 text-gray-600 whitespace-pre-line">{step.instructions}</p>
      {step.id === 5 && (
        <div className="mb-5">
          <ReadingPassagePanel
            passage={reading.currentPassage}
            loading={reading.loading}
            error={reading.error}
            canChange={!upload.isUploading && recordings.length === 0}
            hasAlternatives={reading.count > 1}
            onRetry={reading.onRetry}
            onChange={reading.onChange}
          />
        </div>
      )}
      <div className="my-4 p-3 bg-gray-100 rounded-lg space-y-1">
        <p className="font-semibold">进度: {recordings.length} / {step.recordingsNeeded}</p>
        {step.recordingLabels && <p className="text-sm text-gray-500">当前录制: {step.recordingLabels[recordings.length] || '已完成'}</p>}
        <p className="text-xs text-gray-400">如说错或失误，可点击“停止录音且放弃”——本段不会计入进度。</p>
      </div>
      {upload.discardInfo && <div className="my-3 p-2 bg-gray-50 text-gray-600 rounded text-sm">已放弃刚才的录音，本次不计入进度。</div>}
      {upload.isUploading && ownsPending && <p className="my-4 text-blue-600">正在上传...</p>}
      {upload.error && ownsPending && (
        <div className="my-4">
          <ApiErrorNotice error={upload.error} onRetry={upload.pendingRecording ? upload.onRetry : undefined} compact />
          <p className="mt-2 text-sm text-gray-600">该原始片段只在本浏览器临时保留，最迟随测试会话在 60 分钟后失效。</p>
          <button onClick={upload.onDiscardFailed} className="mt-3 px-3 py-2 text-red-700 border border-red-300 rounded-lg">放弃未上传片段</button>
        </div>
      )}
      {pendingStep != null && !ownsPending && (
        <div className="my-4 p-3 bg-blue-50 text-blue-800 rounded-lg">
          <p>“{VOICE_TEST_STEPS[pendingStep].title}”有{upload.isUploading ? '正在上传' : '未上传'}的片段。</p>
          <button onClick={() => onGoToPending(pendingStep)} className="mt-2 underline">返回该步骤处理</button>
        </div>
      )}
      {allDone && !ownsPending && <div className="my-4 p-3 bg-green-100 text-green-800 rounded-lg"><p>✅ 本步骤所有录音已完成。</p></div>}
      <div className="mt-4">
        <Recorder
          key={`${step.id}-${recordings.length}`}
          onRecordingComplete={onRecordingComplete}
          onDiscardRecording={upload.onDiscardRecording}
          isRecording={upload.isUploading || Boolean(upload.error) || allDone || (step.id === 5 && !reading.currentPassage)}
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button onClick={onRestart} disabled={upload.isUploading} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">重新开始测试</button>
      </div>
      {recordings.length > 0 && (
        <div className="mt-8 text-left max-w-xl mx-auto">
          <h4 className="font-semibold mb-2 text-gray-700 text-sm">已录制文件（列表仅表示本地进度，后端暂不支持删除已上传文件）</h4>
          <ul className="space-y-2 max-h-60 overflow-auto pr-1 text-xs">
            {recordings.map((recording, index) => {
              const active = playback.active.blob === recording.blob;
              return (
                <li key={recording.fileName} className="bg-white border border-gray-200 rounded px-3 py-2 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate mr-2 font-medium">{recording.fileName}</span>
                    <div className="flex items-center">
                      {recording.blob ? <button onClick={() => playback.onToggle(recording.blob)} className={`px-2 py-1 text-white rounded-md transition-colors text-xs ${active && playback.active.isPlaying ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}>{active && playback.active.isPlaying ? '暂停' : '播放'}</button> : <span className="text-green-700">已上传</span>}
                      <span className="text-gray-400 ml-2">#{index + 1}</span>
                    </div>
                  </div>
                  {active && <div className="flex items-center gap-2"><input aria-label={`${recording.fileName} 播放进度`} type="range" min="0" max={playback.active.duration || 0} value={playback.active.progress} onChange={playback.onSeek} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" /><span className="text-gray-500 text-xs">{new Date(playback.active.progress * 1000).toISOString().substr(14, 5)}</span></div>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
