/**
 * @file 管理后台朗读稿件页面
 * @description 管理嗓音测试可选稿件的标题、作者、正文和启用状态。
 */
import { useCallback, useEffect, useState } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { deleteReadingPassage, listReadingPassages, saveReadingPassage } from '../services/dynamodb';

const emptyDraft = () => ({ passageId: crypto.randomUUID(), title: '', author: '', content: '', enabled: true });

/** 朗读稿件增删改与启停页面。 */
export default function ReadingPassagesPage() {
  const { clients } = useAWSClients();
  const [passages, setPassages] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPassages(await listReadingPassages(clients.dynamoDB)); }
    catch (loadError) { setError(loadError.message || '无法读取稿件'); }
    finally { setLoading(false); }
  }, [clients.dynamoDB]);

  useEffect(() => { load(); }, [load]);

  const submit = async event => {
    event.preventDefault(); setError(''); setNotice('');
    const replacing = passages.find(item => item.passageId === draft.passageId);
    const enabledAfterSave = passages.filter(item => item.enabled && item.passageId !== draft.passageId).length + (draft.enabled ? 1 : 0);
    if (enabledAfterSave === 0) { setError('至少需要保留一篇启用稿件'); return; }
    setSaving(true);
    try {
      const saved = await saveReadingPassage(clients.dynamoDB, { ...draft, createdAt: replacing?.createdAt });
      setPassages(items => [...items.filter(item => item.passageId !== saved.passageId), saved].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')));
      setDraft(emptyDraft()); setNotice('稿件已保存');
    } catch (saveError) { setError(saveError.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const remove = async passage => {
    if (passage.enabled && passages.filter(item => item.enabled).length <= 1) { setError('不能删除最后一篇启用稿件'); return; }
    if (!window.confirm(`确定删除《${passage.title}》吗？`)) return;
    setSaving(true); setError(''); setNotice('');
    try { await deleteReadingPassage(clients.dynamoDB, passage.passageId); setPassages(items => items.filter(item => item.passageId !== passage.passageId)); setNotice('稿件已删除'); }
    catch (deleteError) { setError(deleteError.message || '删除失败'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 text-gray-100">
      <h1 className="text-2xl font-bold text-white">朗读稿件</h1>
      <p className="mt-2 text-gray-400">管理嗓音测试朗读步骤可用的稿件。至少保留一篇启用内容。</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-700 bg-red-950 p-3 text-red-200">{error} <button type="button" onClick={load} className="ml-2 underline">重新读取</button></p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-green-950 p-3 text-green-200">{notice}</p>}

      <form onSubmit={submit} className="mt-6 rounded-xl bg-gray-800 p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">{passages.some(item => item.passageId === draft.passageId) ? '编辑稿件' : '新增稿件'}</h2>
        <label className="block">标题<input value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} className="mt-1 w-full rounded bg-gray-900 p-3" /></label>
        <label className="block">作者<input value={draft.author} onChange={event => setDraft(value => ({ ...value, author: event.target.value }))} className="mt-1 w-full rounded bg-gray-900 p-3" /></label>
        <label className="block">正文<textarea rows="10" value={draft.content} onChange={event => setDraft(value => ({ ...value, content: event.target.value }))} className="mt-1 w-full rounded bg-gray-900 p-3" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft(value => ({ ...value, enabled: event.target.checked }))} />在用户端启用</label>
        <div className="flex flex-wrap gap-3"><button disabled={saving} className="rounded bg-purple-600 px-5 py-2 font-semibold disabled:opacity-50">{saving ? '保存中…' : '保存稿件'}</button><button type="button" onClick={() => setDraft(emptyDraft())} className="rounded border border-gray-600 px-5 py-2">清空表单</button></div>
      </form>

      <section className="mt-8"><h2 className="text-xl font-semibold">稿件库</h2>{loading ? <p role="status" className="mt-4">正在读取…</p> : <div className="mt-4 grid gap-4">{passages.map(passage => <article key={passage.passageId} className="rounded-xl bg-gray-800 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">《{passage.title}》</h3><p className="text-sm text-gray-400">{passage.author} · {passage.enabled ? '已启用' : '已停用'}</p></div><div className="flex gap-2"><button type="button" onClick={() => setDraft({ ...passage })} className="rounded border border-purple-500 px-3 py-2">编辑</button><button type="button" disabled={saving} onClick={() => remove(passage)} className="rounded border border-red-600 px-3 py-2 text-red-300">删除</button></div></div><p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-gray-300">{passage.content}</p></article>)}</div>}</section>
    </div>
  );
}
