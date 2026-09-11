/** @file 管理后台朗读稿件页面测试 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ReadingPassagesPage from '../../../src/admin/components/ReadingPassagesPage';

const { listReadingPassages, saveReadingPassage, deleteReadingPassage, mockClient } = vi.hoisted(() => ({
  listReadingPassages: vi.fn(), saveReadingPassage: vi.fn(), deleteReadingPassage: vi.fn(), mockClient: {},
}));
vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({ useAWSClients: () => ({ clients: { dynamoDB: mockClient } }) }));
vi.mock('../../../src/admin/services/dynamodb', () => ({ listReadingPassages, saveReadingPassage, deleteReadingPassage }));

beforeEach(() => {
  vi.clearAllMocks();
  listReadingPassages.mockResolvedValue([{ passageId: 'p1', title: '晨曦', author: '作者', content: '正文', enabled: true }]);
});

it('加载稿件并阻止删除最后一篇启用内容', async () => {
  render(<ReadingPassagesPage />);
  await screen.findByRole('heading', { name: '《晨曦》' });
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('不能删除最后一篇启用稿件');
  expect(deleteReadingPassage).not.toHaveBeenCalled();
});

it('保存完整草稿后更新列表和成功反馈', async () => {
  saveReadingPassage.mockResolvedValue({ passageId: 'p1', title: '新标题', author: '作者', content: '正文', enabled: true });
  render(<ReadingPassagesPage />);
  await screen.findByRole('heading', { name: '《晨曦》' });
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '新标题' } });
  fireEvent.click(screen.getByRole('button', { name: '保存稿件' }));
  await waitFor(() => expect(saveReadingPassage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: '新标题' })));
  expect(await screen.findByRole('status')).toHaveTextContent('稿件已保存');
});
