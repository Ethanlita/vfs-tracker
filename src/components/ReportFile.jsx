import React, { useEffect, useRef, useState } from 'react';
import { resolveAttachmentUrl } from '../utils/attachments.js';

/**
 * 独立加载报告文件，失败可仅刷新本文件；已取得指标不依赖文件状态。
 * @param {{fileKey:string,label:string,image?:boolean}} props - 文件标识、名称及预览方式。
 * @returns {JSX.Element} 文件预览、下载入口或可恢复的错误状态。
 */
export default function ReportFile({ fileKey, label, image = false }) {
  const [state, setState] = useState({ loading: true, url: '', error: false });
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    pending.current = true;
    setState({ loading: true, url: '', error: false });
    resolveAttachmentUrl(fileKey).then(url => {
      if (active) setState({ loading: false, url, error: !url });
    }).catch(() => {
      if (active) setState({ loading: false, url: '', error: true });
    }).finally(() => { if (active) pending.current = false; });
    return () => { active = false; };
  }, [fileKey, revision]);

  /** 同步锁定重复重试，重新申请临时地址以恢复失败或过期链接。 */
  const refresh = () => {
    if (pending.current) return;
    pending.current = true;
    setState({ loading: true, url: '', error: false });
    setRevision(value => value + 1);
  };
  return <section aria-label={label} className="border rounded-lg p-3 space-y-2 [overflow-wrap:anywhere]">
    <p className="text-sm text-gray-600">{label}</p>
    {state.loading && <p role="status">正在获取文件访问地址...</p>}
    {state.error && <p role="alert">无法打开此文件，请重试获取访问地址。</p>}
    {!state.loading && !state.error && state.url && (image
      ? <img src={state.url} alt={label} className="w-full h-auto rounded" onError={() => setState({ loading: false, url: '', error: true })} />
      : <a href={state.url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg">下载完整PDF报告</a>)}
    <button type="button" disabled={state.loading} onClick={refresh} className="text-sm text-purple-700 underline disabled:opacity-50">
      {state.error ? '重试文件链接' : '刷新文件链接'}
    </button>
  </section>;
}
