/**
 * @file 测试详情模态框
 * 显示嗓音测试完整信息和音频播放
 */

import { useEffect, useState, useRef } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { getUser } from '../services/dynamodb';
import { getTestSessionFiles, getPresignedUrl, listObjects } from '../services/s3';

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    // 处理 Unix 时间戳（秒）
    let date;
    if (typeof dateStr === 'number') {
      date = new Date(dateStr * 1000);
    } else {
      date = new Date(dateStr);
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * 信息行组件
 */
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="py-3 border-b border-gray-700/50 last:border-b-0">
      <dt className="text-sm text-gray-500 mb-1">{label}</dt>
      <dd className={`text-white ${mono ? 'font-mono text-sm break-all' : ''}`}>
        {value || <span className="text-gray-600">-</span>}
      </dd>
    </div>
  );
}

/**
 * 状态徽章组件
 */
function StatusBadge({ status }) {
  const statusConfig = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: '等待中' },
    processing: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: '处理中' },
    done: { bg: 'bg-green-900/50', text: 'text-green-400', label: '已完成' },
    failed: { bg: 'bg-red-900/50', text: 'text-red-400', label: '失败' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

/**
 * 音频播放器组件
 */
function AudioPlayer({ src, label }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('播放失败:', err);
        setError('播放失败');
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = percent * duration;
    }
  };

  const formatTime = (time) => {
    if (!time || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* 播放/暂停按钮 */}
        <button
          onClick={handlePlayPause}
          className="w-10 h-10 flex items-center justify-center bg-purple-600 rounded-full 
                     hover:bg-purple-500 transition-colors text-white"
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* 进度条 */}
        <div className="flex-1">
          <div 
            className="h-2 bg-gray-600 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-purple-500 rounded-full relative"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full 
                              opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setError('音频加载失败')}
      />
    </div>
  );
}

/**
 * 测试详情模态框
 */
export default function TestDetailModal({ test, open, onClose }) {
  const { clients } = useAWSClients();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [audioFiles, setAudioFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 加载用户信息
  useEffect(() => {
    async function loadUser() {
      if (!test?.userId || !clients) {
        setUser(null);
        return;
      }

      try {
        setLoadingUser(true);
        const userData = await getUser(clients.dynamoDB, test.userId);
        setUser(userData);
      } catch (err) {
        console.error('加载用户信息失败:', err);
      } finally {
        setLoadingUser(false);
      }
    }

    if (open && test?.userId) {
      loadUser();
    }
  }, [test?.userId, open, clients]);

  // 加载音频文件
  useEffect(() => {
    async function loadAudioFiles() {
      console.log('[TestDetailModal] loadAudioFiles 开始', { 
        sessionId: test?.sessionId, 
        hasClients: !!clients,
        hasS3: !!clients?.s3 
      });
      
      if (!test?.sessionId || !clients?.s3) {
        console.warn('[TestDetailModal] 缺少 sessionId 或 S3 客户端');
        setAudioFiles([]);
        return;
      }

      try {
        setLoadingFiles(true);
        // 传入 test 对象以便从 test.tests 数组中提取音频路径
        const files = await getTestSessionFiles(clients.s3, test.sessionId, test);
        console.log('[TestDetailModal] 获取到文件:', files);
        
        // 为每个文件获取预签名 URL
        const filesWithUrls = await Promise.all(
          files.map(async (file) => {
            try {
              const url = await getPresignedUrl(clients.s3, file.key);
              console.log('[TestDetailModal] 获取预签名 URL 成功:', file.key);
              return { ...file, url };
            } catch (err) {
              console.error(`获取文件 URL 失败: ${file.key}`, err);
              return { ...file, url: null };
            }
          })
        );

        setAudioFiles(filesWithUrls);
      } catch (err) {
        console.error('加载音频文件失败:', err);
      } finally {
        setLoadingFiles(false);
      }
    }

    if (open && test) {
      loadAudioFiles();
    }
  }, [test?.sessionId, open, clients]);

  // 处理 Escape 键关闭
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !test) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">测试详情</h2>
              <StatusBadge status={test.status} />
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区域 */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
            {/* 用户信息 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                用户信息
              </h3>
              <div className="bg-gray-800 rounded-lg p-4">
                {loadingUser ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full animate-pulse" />
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                      <div className="w-32 h-3 bg-gray-700 rounded animate-pulse" />
                    </div>
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {(user.displayName || user.userId || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {user.displayName || '未设置昵称'}
                      </div>
                      <code className="text-xs text-gray-500">
                        {user.userId}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    <code className="text-xs">{test.userId || '未知用户'}</code>
                  </div>
                )}
              </div>
            </section>

            {/* 测试信息 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                测试信息
              </h3>
              <dl className="bg-gray-800 rounded-lg px-4">
                <InfoRow label="Session ID" value={test.sessionId} mono />
                <InfoRow label="创建时间" value={formatDateTime(test.createdAt)} />
                <InfoRow label="完成时间" value={formatDateTime(test.completedAt)} />
                {test.error && (
                  <InfoRow 
                    label="错误信息" 
                    value={<span className="text-red-400">{test.error}</span>} 
                  />
                )}
              </dl>
            </section>

            {/* 测试结果 - 新格式 (metrics) */}
            {test.metrics && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  分析结果
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 朗读段落 */}
                  {test.metrics.reading?.f0_mean !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">朗读 - 平均基频</div>
                      <div className="text-2xl font-bold text-purple-400 mt-1">
                        {Number(test.metrics.reading.f0_mean).toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {test.metrics.reading?.f0_sd !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">朗读 - 基频标准差</div>
                      <div className="text-2xl font-bold text-blue-400 mt-1">
                        {Number(test.metrics.reading.f0_sd).toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {/* 持续元音 */}
                  {test.metrics.sustained?.f0_mean !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">持续元音 - 平均基频</div>
                      <div className="text-2xl font-bold text-green-400 mt-1">
                        {Number(test.metrics.sustained.f0_mean).toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {test.metrics.sustained?.mpt_s !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">最大发声时间</div>
                      <div className="text-2xl font-bold text-teal-400 mt-1">
                        {Number(test.metrics.sustained.mpt_s).toFixed(2)} <span className="text-sm font-normal">秒</span>
                      </div>
                    </div>
                  )}

                  {/* Jitter 和 Shimmer */}
                  {test.metrics.sustained?.jitter_local_percent !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">Jitter (抖动)</div>
                      <div className="text-lg font-bold text-orange-400 mt-1">
                        {Number(test.metrics.sustained.jitter_local_percent).toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {test.metrics.sustained?.shimmer_local_percent !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">Shimmer (闪烁)</div>
                      <div className="text-lg font-bold text-yellow-400 mt-1">
                        {Number(test.metrics.sustained.shimmer_local_percent).toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {/* HNR */}
                  {test.metrics.sustained?.hnr_db !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">谐噪比 (HNR)</div>
                      <div className="text-lg font-bold text-indigo-400 mt-1">
                        {Number(test.metrics.sustained.hnr_db).toFixed(2)} <span className="text-sm font-normal">dB</span>
                      </div>
                    </div>
                  )}

                  {/* VRP */}
                  {test.metrics.vrp && (
                    <div className="bg-gray-800 rounded-lg p-4 col-span-2">
                      <div className="text-gray-500 text-sm">音域范围 (VRP)</div>
                      <div className="text-lg font-bold text-pink-400 mt-1">
                        {Number(test.metrics.vrp.f0_min || 0).toFixed(1)} - {Number(test.metrics.vrp.f0_max || 0).toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 测试结果 - 旧格式 (result) */}
            {test.result && !test.metrics && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  分析结果
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 平均基频 */}
                  {test.result.meanF0 !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">平均基频</div>
                      <div className="text-2xl font-bold text-purple-400 mt-1">
                        {test.result.meanF0.toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {/* 基频标准差 */}
                  {test.result.stdF0 !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">基频标准差</div>
                      <div className="text-2xl font-bold text-blue-400 mt-1">
                        {test.result.stdF0.toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {/* 基频范围 */}
                  {test.result.minF0 !== undefined && test.result.maxF0 !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4 col-span-2">
                      <div className="text-gray-500 text-sm">基频范围</div>
                      <div className="text-xl font-bold text-green-400 mt-1">
                        {test.result.minF0.toFixed(1)} - {test.result.maxF0.toFixed(1)} <span className="text-sm font-normal">Hz</span>
                      </div>
                    </div>
                  )}

                  {/* 其他指标 */}
                  {test.result.shimmer !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">Shimmer</div>
                      <div className="text-lg font-bold text-yellow-400 mt-1">
                        {(test.result.shimmer * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {test.result.jitter !== undefined && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="text-gray-500 text-sm">Jitter</div>
                      <div className="text-lg font-bold text-orange-400 mt-1">
                        {(test.result.jitter * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 音频文件 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                音频文件 ({audioFiles.length})
              </h3>
              
              {loadingFiles ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto" />
                </div>
              ) : audioFiles.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
                  暂无音频文件
                </div>
              ) : (
                <div className="space-y-3">
                  {audioFiles.filter(f => f.url).map((file) => (
                    <AudioPlayer 
                      key={file.key}
                      src={file.url}
                      label={file.name}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 原始数据（调试用） */}
            <section>
              <details className="group">
                <summary className="text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer 
                                    hover:text-gray-400 transition-colors">
                  原始数据 (JSON)
                </summary>
                <pre className="mt-3 bg-gray-800 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(test, null, 2)}
                </pre>
              </details>
            </section>
          </div>

          {/* 底部 */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
