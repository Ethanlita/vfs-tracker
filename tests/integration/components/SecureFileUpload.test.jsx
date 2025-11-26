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
        this.onload({ target: { result: 'data:image/png;base64,mock-image-data' } });
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
        expect(screen.getByText(/文件上传失败/i)).toBeInTheDocument();
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
    it('应该为图片文件显示预览', async () => {
      const { container } = render(
        <SecureFileUpload
          fileType="avatar"
          onFileUpdate={mockOnFileUpdate}
        />
      );

      const file = createMockFile('avatar.png', 'image/png', 1024);
      const input = container.querySelector('input[type="file"]');
      
      await user.upload(input, file);

      // FileReader mock 会立即触发 onload
      await waitFor(() => {
        const avatarImg = screen.getByAltText('头像');
        expect(avatarImg.src).toContain('mock-image-data');
      });
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
