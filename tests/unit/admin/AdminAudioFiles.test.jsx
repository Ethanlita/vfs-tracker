/**
 * @file 管理测试详情音频状态测试
 * @description 验证加载、真实空结果、读取失败、链接失败和原地恢复。
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestDetailModal from '../../../src/admin/components/TestDetailModal.jsx';

const serviceMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getTestSessionFiles: vi.fn(),
  getPresignedUrl: vi.fn(),
}));
const clients = { dynamoDB: { synthetic: true }, s3: { synthetic: true } };
const testSession = {
  sessionId: 'session-audio',
  userId: 'user-audio',
  status: 'done',
  createdAt: 1_700_000_000,
};
const audioFile = {
  key: 'voice-tests/session-audio/raw/reading.wav',
  name: 'reading.wav',
  size: 128,
};

vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({ clients }),
}));
vi.mock('../../../src/admin/services/dynamodb', () => ({
  getUser: serviceMocks.getUser,
}));
vi.mock('../../../src/admin/services/s3', () => ({
  getTestSessionFiles: serviceMocks.getTestSessionFiles,
  getPresignedUrl: serviceMocks.getPresignedUrl,
}));

describe('管理测试详情音频状态', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach(mock => mock.mockReset());
    serviceMocks.getUser.mockResolvedValue(null);
  });

  it('请求未完成时显示加载状态而不是空列表', () => {
    serviceMocks.getUser.mockReturnValue(new Promise(() => {}));
    serviceMocks.getTestSessionFiles.mockReturnValue(new Promise(() => {}));
    const { container } = render(<TestDetailModal test={testSession} open onClose={vi.fn()} />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('暂无音频文件')).not.toBeInTheDocument();
  });

  it('成功空列表显示真实空状态', async () => {
    serviceMocks.getTestSessionFiles.mockResolvedValue([]);
    render(<TestDetailModal test={testSession} open onClose={vi.fn()} />);

    expect(await screen.findByText('暂无音频文件')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('读取失败显示安全提示，并可原地重试恢复文件', async () => {
    serviceMocks.getTestSessionFiles
      .mockRejectedValueOnce(new Error('AKIA_PRIVATE https://signed.example.test/secret'))
      .mockResolvedValueOnce([audioFile]);
    serviceMocks.getPresignedUrl.mockResolvedValue('https://signed.example.test/audio');
    render(<TestDetailModal test={testSession} open onClose={vi.fn()} />);

    expect(await screen.findByText('音频文件读取失败，请检查网络或服务状态后重试。')).toBeInTheDocument();
    expect(screen.queryByText(/AKIA_PRIVATE|signed\.example\.test\/secret/)).not.toBeInTheDocument();
    expect(screen.queryByText('暂无音频文件')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重试读取音频文件' }));
    expect(await screen.findByText('reading.wav')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试读取音频文件' })).not.toBeInTheDocument();
    expect(serviceMocks.getTestSessionFiles).toHaveBeenCalledTimes(2);
  });

  it('部分签名失败保留文件名并可重试获取播放链接', async () => {
    serviceMocks.getTestSessionFiles.mockResolvedValue([audioFile]);
    serviceMocks.getPresignedUrl
      .mockRejectedValueOnce(new Error('synthetic signing failure'))
      .mockResolvedValueOnce('https://signed.example.test/audio');
    render(<TestDetailModal test={testSession} open onClose={vi.fn()} />);

    expect(await screen.findByText('部分音频的播放链接获取失败。')).toBeInTheDocument();
    expect(screen.getByText('reading.wav：播放链接暂不可用')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重试获取播放链接' }));
    expect(await screen.findByText('reading.wav')).toBeInTheDocument();
    expect(screen.queryByText('部分音频的播放链接获取失败。')).not.toBeInTheDocument();
    expect(serviceMocks.getPresignedUrl).toHaveBeenCalledTimes(2);
  });

  it('媒体加载失败可沿同一路径重新获取签名链接', async () => {
    serviceMocks.getTestSessionFiles.mockResolvedValue([audioFile]);
    serviceMocks.getPresignedUrl
      .mockResolvedValueOnce('https://signed.example.test/expired')
      .mockResolvedValueOnce('https://signed.example.test/fresh');
    const { container } = render(<TestDetailModal test={testSession} open onClose={vi.fn()} />);

    const audio = await screen.findByText('reading.wav').then(() => container.querySelector('audio'));
    fireEvent.error(audio);
    expect(screen.getByText('reading.wav：音频加载失败')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新获取播放链接' }));
    expect(await screen.findByText('reading.wav')).toBeInTheDocument();
    expect(container.querySelector('audio')).toHaveAttribute('src', 'https://signed.example.test/fresh');
  });
});
