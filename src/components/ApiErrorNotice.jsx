import React, { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { formatApiError } from '../utils/formatApiError.js';

const baseClasses = 'rounded-md border border-red-200 bg-red-50 text-red-700';

export function ApiErrorNotice({
  error,
  onRetry,
  retryLabel = '重试',
  className = '',
  compact = false,
  includeResponseBody = false
}) {
  const formatted = useMemo(() => {
    if (!error) return { summary: '', detailItems: [] };
    return formatApiError(error, { includeResponseBody });
  }, [error, includeResponseBody]);
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  useEffect(() => {
    setExpanded(false);
  }, [error]);

  if (!error) return null;

  const { summary, detailItems } = formatted;

  const containerClasses = [
    baseClasses,
    compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
    'shadow-sm',
    'space-y-1',
    className
  ].filter(Boolean).join(' ');

  const retryButtonClasses = compact
    ? 'mt-1 inline-flex items-center rounded px-2 py-1 text-[11px] font-medium bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'
    : 'mt-2 inline-flex items-center rounded px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1';

  const buttonClasses = compact
    ? 'inline-flex items-center rounded px-2 py-1 text-[11px] font-medium text-red-700 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1'
    : 'inline-flex items-center rounded px-2.5 py-1.5 text-xs font-medium text-red-700 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1';

  return (
    <div role="alert" aria-live="polite" className={containerClasses}>
      <div className={compact ? 'font-semibold' : 'text-sm font-semibold'}>{summary}</div>
      {detailItems.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            className={buttonClasses}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded(prev => !prev)}
          >
            {expanded ? '收起详情' : '显示全部'}
          </button>
        </div>
      )}
      {expanded && detailItems.length > 0 && (
        <ul id={detailId} className={compact ? 'mt-1 space-y-0.5 text-[11px]' : 'mt-2 space-y-0.5 text-xs'}>
          {detailItems.map(({ label, value }, index) => (
            <li key={`${label}-${index}`} className="flex flex-wrap gap-1">
              <span className="font-medium">{label}：</span>
              <span className="break-all">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button
          type="button"
          className={retryButtonClasses}
          onClick={(event) => {
            if (typeof onRetry === 'function') {
              onRetry(event);
            }
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

ApiErrorNotice.propTypes = {
  error: PropTypes.oneOfType([
    PropTypes.instanceOf(Error),
    PropTypes.shape({ message: PropTypes.string })
  ]),
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
  className: PropTypes.string,
  compact: PropTypes.bool,
  includeResponseBody: PropTypes.bool
};

export default ApiErrorNotice;

