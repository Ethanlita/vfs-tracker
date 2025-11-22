/**
 * 单元测试: src/components/AvatarUpload.jsx
 * 测试头像上传组件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarUpload from '../../../src/components/AvatarUpload.jsx';

// Mock SecureFileUpload组件
vi.mock('../../../src/components/SecureFileUpload', () => ({
  default: ({ fileType, currentFileUrl, onFileUpdate, allowedTypes, maxSize }) => (
    <div data-testid="secure-file-upload">
      <input
        type="text"
        data-testid="file-type"
        value={fileType}
        readOnly
      />
      <input
        type="text"
        data-testid="current-file-url"
        value={currentFileUrl || ''}
        readOnly
      />
      <input
        type="text"
        data-testid="allowed-types"
        value={allowedTypes.join(',')}
        readOnly
      />
      <input
        type="text"
        data-testid="max-size"
        value={maxSize}
        readOnly
      />
      <button
        data-testid="trigger-file-update"
        onClick={() => onFileUpdate('https://s3.example.com/avatar.jpg', 'avatar-key-123')}
      >
        Trigger Update
      </button>
    </div>
  ),
}));

describe('AvatarUpload 组件测试', () => {
  let mockOnAvatarUpdate;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAvatarUpdate = vi.fn();
  });

  describe('基础渲染', () => {
    it('应该渲染SecureFileUpload组件', () => {
      render(
        <AvatarUpload
          currentAvatar="https://example.com/old-avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('secure-file-upload')).toBeInTheDocument();
    });

    it('应该传递fileType为avatar', () => {
      render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('file-type')).toHaveValue('avatar');
    });

    it('应该传递当前头像URL', () => {
      const avatarUrl = 'https://example.com/current-avatar.jpg';
      render(
        <AvatarUpload
          currentAvatar={avatarUrl}
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('current-file-url')).toHaveValue(avatarUrl);
    });

    it('当没有当前头像时应该传递空值', () => {
      render(
        <AvatarUpload
          currentAvatar={null}
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('current-file-url')).toHaveValue('');
    });
  });

  describe('文件类型限制', () => {
    it('应该只允许图片类型', () => {
      render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      const allowedTypes = screen.getByTestId('allowed-types').value;
      expect(allowedTypes).toBe('image/*');
    });

    it('应该设置最大文件大小为5MB', () => {
      render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      const maxSize = screen.getByTestId('max-size').value;
      expect(maxSize).toBe(String(5 * 1024 * 1024)); // 5MB
    });
  });

  describe('文件更新处理', () => {
    it('当SecureFileUpload触发更新时应该调用onAvatarUpdate', async () => {
      const user = userEvent.setup();
      
      render(
        <AvatarUpload
          currentAvatar="https://example.com/old-avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      const triggerButton = screen.getByTestId('trigger-file-update');
      await user.click(triggerButton);

      expect(mockOnAvatarUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnAvatarUpdate).toHaveBeenCalledWith({
        fileUrl: 'https://s3.example.com/avatar.jpg',
        fileKey: 'avatar-key-123',
      });
    });

    it('应该传递文件key和URL对象', async () => {
      const user = userEvent.setup();
      
      render(
        <AvatarUpload
          currentAvatar="https://example.com/old-avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      const triggerButton = screen.getByTestId('trigger-file-update');
      await user.click(triggerButton);

      // 确保传递的是包含 fileKey 与 fileUrl 的对象，方便父组件即时更新
      const callArg = mockOnAvatarUpdate.mock.calls[0][0];
      expect(callArg).toMatchObject({
        fileKey: 'avatar-key-123',
        fileUrl: 'https://s3.example.com/avatar.jpg',
      });
      expect(callArg.fileKey).not.toContain('https://');
    });

    it('多次更新应该每次都调用onAvatarUpdate', async () => {
      const user = userEvent.setup();
      
      render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      const triggerButton = screen.getByTestId('trigger-file-update');
      
      await user.click(triggerButton);
      await user.click(triggerButton);
      await user.click(triggerButton);

      expect(mockOnAvatarUpdate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Props传递', () => {
    it('应该正确传递所有必需的props到SecureFileUpload', () => {
      const avatarUrl = 'https://example.com/test-avatar.jpg';
      
      render(
        <AvatarUpload
          currentAvatar={avatarUrl}
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      // 验证所有props都正确传递
      expect(screen.getByTestId('file-type')).toHaveValue('avatar');
      expect(screen.getByTestId('current-file-url')).toHaveValue(avatarUrl);
      expect(screen.getByTestId('allowed-types')).toHaveValue('image/*');
      expect(screen.getByTestId('max-size')).toHaveValue(String(5 * 1024 * 1024));
    });
  });

  describe('边界情况', () => {
    it('处理undefined currentAvatar', () => {
      render(
        <AvatarUpload
          currentAvatar={undefined}
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('current-file-url')).toHaveValue('');
    });

    it('处理空字符串currentAvatar', () => {
      render(
        <AvatarUpload
          currentAvatar=""
          onAvatarUpdate={mockOnAvatarUpdate}
        />
      );

      expect(screen.getByTestId('current-file-url')).toHaveValue('');
    });

    it('onAvatarUpdate未定义时不应该崩溃', () => {
      expect(() => {
        render(
          <AvatarUpload
            currentAvatar="https://example.com/avatar.jpg"
            onAvatarUpdate={undefined}
          />
        );
      }).not.toThrow();
    });
  });
});
