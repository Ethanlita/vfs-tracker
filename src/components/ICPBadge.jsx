import React from 'react';

const ICPBadge = () => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith('.cn')) {
    return null;
  }

  const recordNo = '粤ICP备XXXXXXX号-1'; // TODO: 上线前替换为真实备案号

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
