/** @file 模态生命周期、背景滚动与焦点恢复；真实顶层隔离另由浏览器验证。 */
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import ModalDialog from '../../../src/components/ModalDialog';
afterEach(cleanup);
it('挂到body、初始聚焦关闭，卸载恢复原入口与滚动', () => {
 const opener=document.createElement('button');document.body.append(opener);opener.focus();
 const overflow=document.body.style.overflow;document.body.style.overflow='auto';
 const {unmount}=render(<ModalDialog label="测试详情" onClose={()=>{}}><button data-modal-close>关闭</button></ModalDialog>);
 const dialog=screen.getByRole('dialog',{name:'测试详情'});
 expect(dialog.parentElement).toBe(document.body);expect(screen.getByText('关闭')).toHaveFocus();expect(document.body.style.overflow).toBe('hidden');
 unmount();expect(opener).toHaveFocus();expect(document.body.style.overflow).toBe('auto');opener.remove();document.body.style.overflow=overflow;
});
it('Escape的cancel与遮罩可关闭，内容点击不关闭',()=>{
 const close=vi.fn();render(<ModalDialog label="详情" onClose={close}><button>内容</button></ModalDialog>);
 const dialog=screen.getByRole('dialog');fireEvent.click(screen.getByText('内容'));expect(close).not.toHaveBeenCalled();
 fireEvent.click(dialog.firstElementChild);expect(close).toHaveBeenCalledTimes(1);fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));expect(close).toHaveBeenCalledTimes(2);
});

it('当前控件因内容更新被移除时恢复到关闭按钮', async () => {
 const {rerender}=render(<ModalDialog label="详情" onClose={()=>{}}><button data-modal-close>关闭</button><button>翻页</button></ModalDialog>);
 screen.getByText('翻页').focus();
 rerender(<ModalDialog label="详情" onClose={()=>{}}><button data-modal-close>关闭</button></ModalDialog>);
 await waitFor(()=>expect(screen.getByText('关闭')).toHaveFocus());
});
