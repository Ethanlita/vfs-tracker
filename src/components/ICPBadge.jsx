import React from 'react';

/**
 * ICP 备案徽章组件
 * 仅在 .cn 域名下显示
 */
const ICPBadge = () => {
  // 服务端渲染时直接返回 null
  if (typeof window === 'undefined') return null;
  
  // 测试环境下可能没有 window.location.hostname，需要处理
  const hostname = window.location?.hostname;
  if (!hostname) return null;
  
  const host = hostname.toLowerCase();
  if (!host.endsWith('.cn')) {
    return null;
  }

  const recordNo = '桂ICP备2025072780号-1 桂公网安备45010002451122号';

  return (
    <div className="w-full flex justify-center items-center py-4 border-t border-gray-200">
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-600 hover:text-gray-800"
      >
        {recordNo}
      </a>
    </div>
  );
};

export default ICPBadge;
