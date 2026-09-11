/**
 * @file SecureFileUpload.test.jsx
 * @description SecureFileUpload组件的集成测试
 * 
 * 测试覆盖：
 * 1. 基础渲染（头像模式和通用模式）
 * 2. 文件选择和验证
 * 3. 文件上传流程
 * 4. 错误处理
 * 5. 预览功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecureFileUpload from '../../../src/components/SecureFileUpload';
import * as api from '../../../src/api';

// Mock AuthContext
const mockUseAuth = vi.fn();

vi.mock('../../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth()
  };
});

// Mock API functions
vi.mock('../../../src/api', async () => {
  const actual = await vi.importActual('../../../src/api');
  return {
    ...actual,
    getUploadUrl: vi.fn(),
    getFileUrl: vi.fn(),
    getAvatarUrl: vi.fn()
  };
});

// Mock avatar utils
vi.mock('../../../src/utils/avatar', () => ({
  generateAvatar: vi.fn(() => 'data:image/svg+xml;base64,mock-avatar-data')
}));

describe('SecureFileUpload Component', () => {
  const user = userEvent.setup();
  const mockUser = { userId: 'test-user-123', username: 'testuser', email: 'test@example.com' };
  const mockOnFileUpdate = vi.fn();

  // 保存原始全局对象
  let originalFileReader;
  let originalImage;
  let originalFetch;

  beforeAll(() => {
    // 保存原始全局对象引用
    originalFileReader = global.FileReader;
    originalImage = global.Image;
  });

  /**
   * 创建测试文件
   */
  const createMockFile = (name = 'test.png', type = 'image/png', size = 1024) => {
    const file = new File(['test'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  /**
   * 设置默认 mock
   */
  const setupMocks = () => {
    mockUseAuth.mockReturnValue({ user: mockUser });
    api.getUploadUrl.mockResolvedValue('https://s3.example.com/upload-url');
    api.getFileUrl.mockResolvedValue('https://s3.example.com/file-url');
    api.getAvatarUrl.mockResolvedValue('https://s3.example.com/avatar-url');
    
    // 保存原始fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    // Mock FileReader
    global.FileReader = class {
      readAsDataURL(blob) {
        this.result = 'data:image/png;base64,mock-image-data';
        this.onload({ target: this });
      }
    };

    // Mock Image
    global.Image = class {
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    // 恢复原始全局对象
    if (originalFileReader) {
      global.FileReader = originalFileReader;
    }
    if (originalImage) {
      global.Image = originalImage;
    }
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });


  it.each(['avatar','attachment'])('键盘可到达 %s 文件入口并激活原生输入',async fileType=>{
    const {container}=render(<SecureFileUpload fileType={fileType} onFileUpdate={mockOnFileUpdate}/>);
    const input=container.querySelector('input[type="file"]'),click=vi.spyOn(input,'click');
    await user.tab();expect(screen.getByRole('button',{name:fileType==='avatar'?'更换头像':'选择文件'})).toHaveFocus();
    await user.keyboard('{Enter}');expect(click).toHaveBeenCalledTimes(1);
  });
  it('上传失败后复用原文件重试，也允许再次选择同一个文件',async()=>{
    api.getUploadUrl.mockRejectedValueOnce(new Error('network failed'));
    const {container}=render(<SecureFileUpload fileType="attachment" onFileUpdate={mockOnFileUpdate}/>);
    const input=container.querySelector('input[type="file"]'),file=createMockFile();
    await user.upload(input,file);await screen.findByRole('button',{name:/重试/});
    await user.click(screen.getByRole('button',{name:/重试/}));await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({body:file}));
    await user.upload(input,file);await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(2));
  });

  it.each(['address','put','url'])('整个上传过程保持忙碌直到 %s 阶段结束',async stage=>{
    let release;const pending=new Promise(resolve=>{release=resolve});
    if(stage==='address')api.getUploadUrl.mockReturnValueOnce(pending);
    if(stage==='put')global.fetch.mockReturnValueOnce(pending);
    if(stage==='url')api.getFileUrl.mockReturnValueOnce(pending);
    const status=vi.fn(),{container}=render(<SecureFileUpload fileType="attachment" onFileUpdate={mockOnFileUpdate} onStatusChange={status}/>);
    await user.upload(container.querySelector('input[type=file]'),createMockFile());
    expect(status).toHaveBeenLastCalledWith('uploading');expect(mockOnFileUpdate).not.toHaveBeenCalled();
    release(stage==='put'?{ok:true}:'https://example.test/file');await waitFor(()=>expect(status).toHaveBeenLastCalledWith('idle'));expect(mockOnFileUpdate).toHaveBeenCalledTimes(1);
  });
  it('失败后显式放弃附件清除错误并解除提交阻塞',async()=>{
    api.getUploadUrl.mockRejectedValueOnce(new Error('failed'));const status=vi.fn(),{container}=render(<SecureFileUpload fileType="attachment" onFileUpdate={mockOnFileUpdate} onStatusChange={status}/>);
    await user.upload(container.querySelector('input[type=file]'),createMockFile());await waitFor(()=>expect(status).toHaveBeenLastCalledWith('error'));
    await user.click(screen.getByRole('button',{name:'放弃此附件'}));expect(status).toHaveBeenLastCalledWith('idle');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(mockOnFileUpdate).not.toHaveBeenCalled();
  });

  it.each(['attachment','avatar'])('%s上传后链接失败只重试链接，不重复PUT',async fileType=>{
    const getUrl=fileType==='avatar'?api.getAvatarUrl:api.getFileUrl;
    getUrl.mockRejectedValueOnce(new Error('link failed'));
    const {container}=render(<SecureFileUpload fileType={fileType} onFileUpdate={mockOnFileUpdate}/>);
    await user.upload(container.querySelector('input[type=file]'),createMockFile());
    expect(await screen.findByRole('alert')).toHaveTextContent('文件已上传');
    expect(mockOnFileUpdate).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:/重试/}));
    await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(1));expect(global.fetch).toHaveBeenCalledTimes(1);expect(api.getUploadUrl).toHaveBeenCalledTimes(1);expect(getUrl).toHaveBeenCalledTimes(2);
  });
  it.each(['',null,'attachments/raw-key.png'])('上传后的无效链接 %s 不加入事件，恢复只请求链接',async url=>{
    api.getFileUrl.mockResolvedValueOnce(url);
    const {container}=render(<SecureFileUpload fileType="attachment" onFileUpdate={mockOnFileUpdate}/>);
    await user.upload(container.querySelector('input[type=file]'),createMockFile());await screen.findByRole('alert');expect(mockOnFileUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button',{name:/重试/}));await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(1));expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  describe('基础渲染', () => {
    it('应该在头像模式下渲染头像上传界面', () => {
      render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      expect(screen.getByText('头像')).toBeInTheDocument();
      expect(screen.getByText('更换头像')).toBeInTheDocument();
      expect(screen.getByAltText('头像')).toBeInTheDocument();
    });

    it('应该在通用模式下渲染文件上传界面', () => {
      render(
        <SecureFileUpload
          fileType="upload"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      expect(screen.getByText('选择文件')).toBeInTheDocument();
      expect(screen.getByText(/支持:/)).toBeInTheDocument();
    });

    it('应该显示当前文件URL（如果存在）', () => {
      render(
        <SecureFileUpload
          fileType="upload"
          currentFileUrl="https://example.com/file.pdf"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      expect(screen.getByText('当前文件已上传')).toBeInTheDocument();
    });

    it('应该显示文件大小限制', () => {
      render(
        <SecureFileUpload
          fileType="avatar"
          maxSize={5 * 1024 * 1024}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      expect(screen.getByText('最大5MB')).toBeInTheDocument();
    });

    it('应该显示默认头像（如果没有当前头像）', () => {
      render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const avatarImg = screen.getByAltText('头像');
      expect(avatarImg).toHaveAttribute('src', expect.stringContaining('mock-avatar-data'));
    });
  });

  describe('文件选择和验证', () => {
    it('应该允许选择正确类型的文件', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          allowedTypes={['image/*']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024 * 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalled();
      });
    });

    it('应该拒绝不允许的文件类型', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          allowedTypes={['image/*']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('document.pdf', 'application/pdf', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      // 验证上传没有继续进行
      await waitFor(() => {
        expect(api.getUploadUrl).not.toHaveBeenCalled();
      });

      // 应该显示某种错误状态（ApiErrorNotice 或错误文本）
      // 注意：由于 ValidationError 可能不会渲染 ApiErrorNotice，这里只验证上传被阻止
      expect(mockOnFileUpdate).not.toHaveBeenCalled();
    });

    it('应该拒绝超过大小限制的文件', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          maxSize={1 * 1024 * 1024} // 1MB
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('large.png', 'image/png', 2 * 1024 * 1024); // 2MB
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/文件大小不能超过/i)).toBeInTheDocument();
      });

      expect(api.getUploadUrl).not.toHaveBeenCalled();
    });

    it('应该支持通配符类型匹配', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="upload"
          allowedTypes={['image/*', 'application/pdf']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const imageFile = createMockFile('test.jpg', 'image/jpeg', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, imageFile);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalled();
      });
    });
  });

  describe('文件上传流程', () => {
    it('应该成功上传文件并调用回调', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalledWith(
          expect.stringContaining('avatars/test-user-123/'),
          'image/png'
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://s3.example.com/upload-url',
          expect.objectContaining({
            method: 'PUT',
            body: file
          })
        );
      });

      await waitFor(() => {
        expect(api.getAvatarUrl).toHaveBeenCalledWith(
          'test-user-123',
          expect.stringContaining('avatars/test-user-123/')
        );
      });

      await waitFor(() => {
        expect(mockOnFileUpdate).toHaveBeenCalledWith(
          'https://s3.example.com/avatar-url',
          expect.stringContaining('avatars/test-user-123/')
        );
      });
    });

    it('应该为不同文件类型使用正确的存储路径 - attachment', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="attachment"
          allowedTypes={['application/pdf', 'image/*']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalledWith(
          expect.stringContaining('attachments/test-user-123/'),
          'application/pdf'
        );
      });
    });

    it('应该为不同文件类型使用正确的存储路径 - upload', async () => {
      vi.clearAllMocks();
      setupMocks();

      const { container } = render(
        <SecureFileUpload
          fileType="upload"
          allowedTypes={['application/pdf', 'image/*']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalledWith(
          expect.stringContaining('uploads/test-user-123/'),
          'application/pdf'
        );
      });
    });

    it('应该在上传期间显示加载状态', async () => {
      // 延迟 fetch 响应
      global.fetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))
      );

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      // 应该显示上传中状态
      expect(screen.getByText('上传中...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('更换头像')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('应该生成包含时间戳的文件key', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getUploadUrl).toHaveBeenCalledWith(
          `avatars/test-user-123/${now}-test-user-123.png`,
          'image/png'
        );
      });

      vi.restoreAllMocks();
    });
  });

  describe('错误处理', () => {
    it('应该处理获取上传URL失败', async () => {
      api.getUploadUrl.mockRejectedValue(new Error('获取上传地址失败'));

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/文件上传失败/i)).toBeInTheDocument();
      });

      expect(mockOnFileUpdate).not.toHaveBeenCalled();
    });

    it('应该处理S3上传失败', async () => {
      global.fetch.mockResolvedValue({ 
        ok: false, 
        status: 403,
        statusText: 'Forbidden'
      });

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/文件上传失败/i)).toBeInTheDocument();
      });

      expect(mockOnFileUpdate).not.toHaveBeenCalled();
    });

    it('应该处理获取文件URL失败', async () => {
      api.getAvatarUrl.mockRejectedValue(new Error('获取文件URL失败'));

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/文件已上传，但访问地址获取失败/i)).toBeInTheDocument();
      });
    });

    it('错误发生时应该清除预览', async () => {
      api.getUploadUrl.mockRejectedValue(new Error('Upload failed'));

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          currentFileUrl="https://example.com/old-avatar.png"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText(/文件上传失败/i)).toBeInTheDocument();
      });

      // 预览应该被清除，回退到默认头像或旧头像
      const avatarImg = screen.getByAltText('头像');
      expect(avatarImg.src).not.toContain('mock-image-data');
    });
  });

  describe('图片预览功能', () => {

    it('保存完成前显示旧头像，父级失败后保留旧图且重试不重复上传',async()=>{
      let rejectSave;mockOnFileUpdate.mockImplementationOnce(()=>new Promise((resolve,reject)=>{rejectSave=reject})).mockResolvedValueOnce(undefined);
      const {container,rerender}=render(<SecureFileUpload fileType="avatar" currentFileUrl="https://example.test/old.png" onFileUpdate={mockOnFileUpdate}/>);
      await user.upload(container.querySelector('input[type=file]'),createMockFile());await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(1));
      expect(container.querySelector('input[type=file]')).toBeDisabled();expect(screen.getByAltText('头像')).toHaveAttribute('src','https://example.test/old.png');
      rejectSave(new Error('保存失败'));await screen.findByRole('alert');expect(screen.getByAltText('头像')).toHaveAttribute('src','https://example.test/old.png');
      await user.click(screen.getByRole('button',{name:/重试/}));await waitFor(()=>expect(mockOnFileUpdate).toHaveBeenCalledTimes(2));expect(global.fetch).toHaveBeenCalledTimes(1);
      rerender(<SecureFileUpload fileType="avatar" currentFileUrl="https://example.test/new.png" onFileUpdate={mockOnFileUpdate}/>);expect(screen.getByAltText('头像')).toHaveAttribute('src','https://example.test/new.png');
    });
    it('无法解码的头像不会上传或调用资料保存',async()=>{
      global.Image=class{set src(value){queueMicrotask(()=>this.onerror())}};
      const {container}=render(<SecureFileUpload fileType="avatar" onFileUpdate={mockOnFileUpdate}/>);
      await user.upload(container.querySelector('input[type=file]'),createMockFile());expect(await screen.findByRole('alert')).toHaveTextContent('有效的图片');expect(api.getUploadUrl).not.toHaveBeenCalled();expect(mockOnFileUpdate).not.toHaveBeenCalled();
    });

    it('头像加载失败时应该显示备用头像', () => {
      // Mock Image 加载失败
      global.Image = class {
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      };

      render(
        <SecureFileUpload
          fileType="avatar"
          currentFileUrl="https://broken-image.com/avatar.png"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const avatarImg = screen.getByAltText('头像');
      
      // Trigger error event
      avatarImg.dispatchEvent(new Event('error'));

      // Should fall back to generated avatar
      expect(avatarImg.src).toContain('mock-avatar-data');
    });
  });

  describe('禁用状态', () => {
    it('上传中时应该禁用文件输入', async () => {
      global.fetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200))
      );

      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      // Input should be disabled while uploading
      expect(input).toBeDisabled();

      await waitFor(() => {
        expect(input).not.toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe('非头像模式特性', () => {
    it('非头像模式应该调用 getFileUrl 而不是 getAvatarUrl', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="upload"
          allowedTypes={['application/pdf', 'image/*']}
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      await waitFor(() => {
        expect(api.getFileUrl).toHaveBeenCalled();
      });

      expect(api.getAvatarUrl).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(mockOnFileUpdate).toHaveBeenCalledWith(
          'https://s3.example.com/file-url',
          expect.any(String),
          expect.objectContaining({
            fileType: 'application/pdf',
            fileName: 'doc.pdf'
          })
        );
      });
    });
  });
});
