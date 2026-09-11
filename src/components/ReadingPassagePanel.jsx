/**
 * @file 朗读稿件展示与切换面板
 * @description 展示稿件正文、作者、朗读说明和投稿入口。
 */

/**
 * 展示当前朗读稿件，并在开始录音前允许切换。
 * @param {{passage?: object, loading: boolean, error?: Error|null, canChange: boolean, hasAlternatives: boolean, onChange: () => void, onRetry: () => void}} props
 * @returns {JSX.Element}
 */
export default function ReadingPassagePanel({ passage, loading, error, canChange, hasAlternatives, onChange, onRetry }) {
  if (loading) return <p role="status" className="text-gray-600">正在加载朗读稿件…</p>;
  if (error) return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p>暂时无法加载朗读稿件，请重试后再开始录音。</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white">重新加载</button>
    </div>
  );
  if (!passage) return <p role="alert" className="text-red-700">当前没有可用的朗读稿件，请稍后再试。</p>;

  return (
    <section aria-labelledby="reading-passage-title" className="w-full rounded-xl border border-purple-200 bg-white p-4 sm:p-6 text-left shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="reading-passage-title" className="text-xl font-bold text-gray-900 break-words">《{passage.title}》</h3>
          <p className="mt-1 text-sm text-gray-600 break-words">作者：{passage.author}</p>
        </div>
        <button type="button" onClick={onChange} disabled={!canChange || !hasAlternatives} className="rounded-lg border border-purple-300 px-4 py-2 font-semibold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
          换一篇
        </button>
      </div>
      <p className="mt-4 whitespace-pre-line leading-8 text-gray-800 [overflow-wrap:anywhere]">{passage.content}</p>
      <p className="mt-5 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">说不完也没关系，按照正常语速说够录音时间即可。</p>
      <p className="mt-3 text-sm text-gray-600">
        想投稿朗读稿件？请通过<a href="/posts/联系和交流" className="mx-1 font-semibold text-purple-700 underline">联系和交流</a>提交标题、正文、署名及授权说明。
      </p>
      {!canChange && <p className="mt-3 text-sm text-amber-700">本步骤已经开始录音；为确保稿件与录音一致，重新开始测试后才能换稿。</p>}
    </section>
  );
}
