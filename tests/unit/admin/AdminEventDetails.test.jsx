/**
 * @file 管理事件契约展示测试
 * @description 验证列表与详情均从当前 details 契约读取六类事件字段。
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventTable from '../../../src/admin/components/EventTable.jsx';
import EventDetailModal from '../../../src/admin/components/EventDetailModal.jsx';
import { eventSchemaPrivate } from '../../../src/api/schemas.js';
import { adminEventDetailFixtures } from '../../../src/test-utils/fixtures/index.js';

const serviceMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateEventStatus: vi.fn(),
  getPresignedUrl: vi.fn(),
}));
const clients = { dynamoDB: { synthetic: true }, s3: { synthetic: true } };

vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({ clients }),
}));
vi.mock('../../../src/admin/services/dynamodb', () => ({
  getUser: serviceMocks.getUser,
  updateEventStatus: serviceMocks.updateEventStatus,
  EVENT_TYPES: {
    self_test: '自测', hospital_test: '医院检测', voice_training: '嗓音训练',
    self_practice: '自主练习', surgery: 'VFS手术', feeling_log: '感受记录',
  },
  EVENT_STATUS: { APPROVED: 'approved', PENDING: 'pending', REJECTED: 'rejected' },
}));
vi.mock('../../../src/admin/services/s3', () => ({
  getPresignedUrl: serviceMocks.getPresignedUrl,
}));

const expectedDetails = {
  self_test: ['平均基频', '自测备注'],
  hospital_test: ['测试医院', '医院备注'],
  voice_training: ['训练内容', '训练老师'],
  self_practice: ['练习内容', '练习感受'],
  surgery: ['李革临', '手术备注'],
  feeling_log: ['今天状态稳定'],
};

describe('管理事件当前契约展示', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach(mock => mock.mockReset());
    serviceMocks.getUser.mockResolvedValue(null);
    serviceMocks.getPresignedUrl.mockResolvedValue('https://signed.example.test/hospital-report');
  });

  it('六类 fixture 均符合私有事件 schema', () => {
    for (const event of adminEventDetailFixtures) {
      expect(eventSchemaPrivate.validate(event).error, event.type).toBeUndefined();
    }
  });

  it('列表按 details 契约显示备注或类型摘要', () => {
    render(<EventTable events={adminEventDetailFixtures} />);
    const expectedSummaries = ['自测备注', '医院备注', '训练内容', '练习内容', '手术备注', '今天状态稳定'];
    for (const summary of expectedSummaries) {
      expect(screen.getByText(summary, { exact: true })).toBeInTheDocument();
    }
    expect(screen.queryByText('-', { exact: true })).not.toBeInTheDocument();
  });

  for (const event of adminEventDetailFixtures) {
    it(`${event.type} 详情在原始 JSON 之外显示契约字段`, async () => {
      render(<EventDetailModal event={event} open onClose={vi.fn()} onUpdate={vi.fn()} />);
      await screen.findByText('用户信息不可用');
      const details = within(screen.getByTestId('event-contract-details'));
      if (event.type === 'hospital_test') {
        await userEvent.click(details.getByRole('button', { name: /其他信息/ }));
      }
      for (const value of expectedDetails[event.type]) {
        expect(details.getAllByText(value, { exact: false }).length).toBeGreaterThan(0);
      }
      if (event.type === 'hospital_test') {
        const attachmentLink = await screen.findByRole('link', { name: '模拟医院报告.pdf' });
        expect(attachmentLink).toHaveAttribute('href', 'https://signed.example.test/hospital-report');
        expect(serviceMocks.getPresignedUrl).toHaveBeenCalledWith(
          clients.s3,
          'attachments/admin-user/模拟医院报告.pdf'
        );
      }
    });
  }
});
