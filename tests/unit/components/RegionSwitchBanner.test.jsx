/**
 * 单元测试: src/components/RegionSwitchBanner.jsx
 * 测试区域切换横幅组件的显示逻辑和交互
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import RegionSwitchBanner from '../../../src/components/RegionSwitchBanner.jsx';

const DISMISS_KEY = 'cnBannerDismissed';

describe('RegionSwitchBanner 组件测试', () => {
  let localStorageMock;
  let originalLocation;
  let originalNavigator;
  let originalIntl;
  let originalLocalStorage;

  beforeAll(() => {
    // 保存原始的全局对象
    originalLocalStorage = global.localStorage;
    originalLocation = window.location;
    originalNavigator = navigator;
    originalIntl = global.Intl;
  });

  afterAll(() => {
    // 恢复原始的全局对象
    global.localStorage = originalLocalStorage;
    window.location = originalLocation;
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true
    });
    global.Intl = originalIntl;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock;

    // Mock Intl.DateTimeFormat to return non-China timezone by default
    global.Intl = {
      ...global.Intl,
      DateTimeFormat: vi.fn(() => ({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基础渲染', () => {
    it('非.app域名不显示横幅', () => {
      // Mock .com domain
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.com' },
        writable: true,
        configurable: true,
      });

      // Mock China locale
      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      // 不应该显示横幅
      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });

    it('.app域名且在首页且未关闭且是中国区时显示横幅', () => {
      // Mock .app domain
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      // Mock China locale (language)
      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });

    it('不在首页时不显示横幅', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });

    it('已关闭时不显示横幅', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue('1'); // dismissed

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });
  });

  describe('区域检测', () => {
    it('时区为Asia/Shanghai时识别为中国区', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      // Mock timezone
      const mockDateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat');
      mockDateTimeFormat.mockImplementation(() => ({
        resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' }),
      }));

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();

      mockDateTimeFormat.mockRestore();
    });

    it('时区为Asia/Urumqi时识别为中国区', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      const mockDateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat');
      mockDateTimeFormat.mockImplementation(() => ({
        resolvedOptions: () => ({ timeZone: 'Asia/Urumqi' }),
      }));

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();

      mockDateTimeFormat.mockRestore();
    });

    it('语言为zh-CN时识别为中国区', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN', 'en-US'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });

    it('语言为zh-Hans时识别为中国区', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-Hans-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });

    it('非中国语言不显示', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['en-US', 'zh-TW'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });
  });

  describe('链接和文案', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);
    });

    it('显示正确的提示文案', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难，可以切换至中国大陆版/)).toBeInTheDocument();
    });

    it('包含正确的链接地址', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const link = screen.getByRole('link', { name: /vfs-tracker\.cn/i });
      expect(link).toHaveAttribute('href', 'https://vfs-tracker.cn');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('显示关闭按钮', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    });
  });

  describe('关闭功能', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);
    });

    it('点击关闭按钮隐藏横幅', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const closeButton = screen.getByRole('button', { name: '关闭' });
      await user.click(closeButton);

      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });

    it('关闭后将状态保存到localStorage', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const closeButton = screen.getByRole('button', { name: '关闭' });
      await user.click(closeButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(DISMISS_KEY, '1');
    });

    it('localStorage.setItem失败时不崩溃', async () => {
      const user = userEvent.setup();
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const closeButton = screen.getByRole('button', { name: '关闭' });
      
      // 不应该抛出错误
      await expect(user.click(closeButton)).resolves.not.toThrow();
      
      // 横幅仍然被隐藏
      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });
  });

  describe('样式', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);
    });

    it('横幅使用固定定位在底部', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const banner = container.firstChild;
      expect(banner).toHaveStyle({ position: 'fixed', bottom: '24px' });
    });

    it('横幅水平居中', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const banner = container.firstChild;
      expect(banner).toHaveStyle({ 
        left: '50%', 
        transform: 'translateX(-50%)' 
      });
    });

    it('横幅有较高的z-index', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const banner = container.firstChild;
      expect(banner).toHaveStyle({ zIndex: '1000' });
    });

    it('横幅使用深色背景', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const banner = container.firstChild;
      expect(banner).toHaveStyle({ 
        background: '#111827',
        color: '#fff'
      });
    });

    it('横幅有圆角和阴影', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      const banner = container.firstChild;
      expect(banner).toHaveStyle({ 
        borderRadius: '12px',
        boxShadow: '0 12px 30px rgba(17, 24, 39, 0.3)'
      });
    });
  });

  describe('边界情况', () => {
    it('localStorage.getItem失败时降级处理', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      // 应该显示横幅 (忽略localStorage错误)
      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });

    it('Intl.DateTimeFormat失败时降级到语言检测', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      // Mock DateTimeFormat to throw
      const mockDateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat');
      mockDateTimeFormat.mockImplementation(() => {
        throw new Error('Not supported');
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      // 仍然应该显示 (通过语言检测)
      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();

      mockDateTimeFormat.mockRestore();
    });

    it('navigator.languages为空数组时不崩溃', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: [],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      // 不应该显示 (无法检测到中国区)
      expect(screen.queryByText(/如果您在中国大陆地区访问遇到困难/)).not.toBeInTheDocument();
    });

    it('navigator.languages为null时降级处理', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'vfs-tracker.app' },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: null,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'language', {
        value: 'zh-CN',
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      // 应该使用navigator.language作为降级
      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });

    it('大小写不敏感的域名检测', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'VFS-Tracker.APP' }, // 大写
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global.navigator, 'languages', {
        value: ['zh-CN'],
        writable: true,
        configurable: true,
      });

      localStorageMock.getItem.mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <RegionSwitchBanner />
        </MemoryRouter>
      );

      expect(screen.getByText(/如果您在中国大陆地区访问遇到困难/)).toBeInTheDocument();
    });
  });
});
