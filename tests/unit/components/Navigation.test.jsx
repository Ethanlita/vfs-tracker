/** @file 共享导航、对话框开闭及访客登录入口；原生焦点约束由浏览器回归验证。 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('@aws-amplify/ui-react',()=>({useAuthenticator:()=>({authStatus:'unauthenticated'})}));
vi.mock('../../../src/contexts/AuthContext.jsx',()=>({useAuth:()=>({user:null,userProfile:null})}));
vi.mock('../../../src/components/PostsDropdown.jsx',()=>({default:()=>null}));
import Header from '../../../src/components/Header.jsx';
import Sidebar from '../../../src/components/Sidebar.jsx';
import { SIDEBAR_ROUTES } from '../../../src/routes/nav';

let dialogMethods;
beforeEach(()=>{
 vi.spyOn(window,'matchMedia').mockImplementation(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 // jsdom未实现原生模态；这里只模拟open属性，不伪造焦点约束测试。
 dialogMethods=['showModal','close'].map(name=>[name,Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,name)]);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
});
afterEach(()=>{
 cleanup();
 for(const [name,descriptor] of dialogMethods){if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,name,descriptor);else delete HTMLDialogElement.prototype[name];}
 vi.restoreAllMocks();vi.unstubAllGlobals();
});
describe('功能导航',()=>{
 it('所有路由唯一，包含添加事件、资料及全部工具',()=>{
  expect(new Set(SIDEBAR_ROUTES.map(item=>item.to)).size).toBe(SIDEBAR_ROUTES.length);
  for(const path of ['/add-event','profile-manager','quick-f0-test','voice-test','scale-practice']){
   expect(SIDEBAR_ROUTES.some(item=>item.to===('/'+path.replace(/^\//,'')))).toBe(true);
  }
 });
 it('菜单具有名称，打开时进入关闭按钮，关闭后不可见',async()=>{
  render(<MemoryRouter><Header/></MemoryRouter>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const trigger=screen.getByRole('button',{name:'打开菜单'});
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog',{name:'全部功能'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'关闭菜单'})).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded','true');
  fireEvent.click(screen.getByRole('button',{name:'关闭菜单'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(()=>expect(trigger).toHaveFocus());
 });
 it('取消事件和导航点击关闭菜单，恢复原滚动设置',()=>{
  const previous=document.body.style.overflow;document.body.style.overflow='auto';
  render(<MemoryRouter><Header/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'打开菜单'}));expect(document.body.style.overflow).toBe('hidden');
  fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:true,cancelable:true}));
  expect(document.body.style.overflow).toBe('auto');
  fireEvent.click(screen.getByRole('button',{name:'打开菜单'}));
  fireEvent.click(screen.getByRole('link',{name:/Hz-音符转换器/}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();document.body.style.overflow=previous;
 });
 it('访客头像指向带原路径的登录页',()=>{
  render(<MemoryRouter initialEntries={['/note-frequency-tool?mode=test']}><Header/></MemoryRouter>);
  expect(screen.getByRole('link',{name:'登录账户'})).toHaveAttribute('href','/login?returnUrl=%2Fnote-frequency-tool%3Fmode%3Dtest');
  expect(screen.getAllByRole('img').every(image=>Boolean(image.getAttribute('src')))).toBe(true);
 });
 it('离线菜单有明确提示且不显示网络功能',()=>{
  vi.stubGlobal('navigator',{onLine:false});
  render(<MemoryRouter><Sidebar open onClose={()=>{}} avatarUrl=""/></MemoryRouter>);
  expect(screen.getByRole('img',{name:'未登录用户'})).toHaveAttribute('src',expect.stringMatching(/\S/));
  expect(screen.getByText('当前离线，仅显示离线可用入口。')).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:/公共仪表板/})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:/快速基频测试/})).toBeInTheDocument();
 });
});
