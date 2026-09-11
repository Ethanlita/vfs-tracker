import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * 原生模态层：隔离背景交互，约束键盘焦点，并在卸载时恢复入口与滚动。
 * @param {object} props - 弹层内容、可访问名称与关闭回调。
 * @returns {React.ReactPortal} 位于body下的顶层对话框。
 */
export default function ModalDialog({ children, label, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    const focusClose = () => dialog.querySelector('[data-modal-close]')?.focus();
    focusClose();
    // 分页加载会禁用当前按钮，浏览器可能把焦点退回body；恢复到稳定的关闭入口。
    const observer = new MutationObserver(() => {
      if (dialog.open && !dialog.contains(document.activeElement)) focusClose();
    });
    observer.observe(dialog, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden'] });
    return () => {
      observer.disconnect();
      dialog.close();
      document.body.style.overflow = overflow;
      // 删除成功可能移除原入口；此时将焦点移到主内容以便继续浏览。
      if (opener?.isConnected && opener !== document.body) opener.focus();
      else {
        const main = document.querySelector('main');
        if (main) {
          const previous = main.getAttribute('tabindex');
          main.setAttribute('tabindex', '-1');
          main.focus();
          if (previous === null) main.removeAttribute('tabindex');
          else main.setAttribute('tabindex', previous);
        }
      }
    };
  }, []);

  /** Tab首尾循环，避免浏览器将焦点移到地址栏。 */
  const handleKeyDown = event => {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && !element.closest('[hidden],[inert]') && element.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); ref.current.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return createPortal(
    <dialog ref={ref} aria-label={label} aria-modal="true" tabIndex={-1}
      onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={handleKeyDown}
      className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 p-0 bg-transparent text-gray-800 backdrop:bg-black/40">
      <div className={`h-full w-full ${className}`} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        {children}
      </div>
    </dialog>, document.body
  );
}
