/** @file React Hook 与 PWA 更新协调器的登记生命周期测试。 */
import React from 'react';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { usePwaUpdateBlocker } from '../../../src/hooks/usePwaUpdateBlocker.js';
import { activatePwaUpdateSafely } from '../../../src/utils/pwaUpdateCoordinator.js';

const Harness = ({ active }) => {
  usePwaUpdateBlocker(active, '测试草稿');
  return null;
};

class QuietBroadcastChannel {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
}

describe('usePwaUpdateBlocker', () => {
  beforeAll(() => vi.stubGlobal('BroadcastChannel', QuietBroadcastChannel));
  it('激活时阻止更新，完成和卸载后解除', async () => {
    const activate = vi.fn();
    const view = render(<Harness active />);
    await expect(activatePwaUpdateSafely(activate, { waitMs: 0 })).resolves.toMatchObject({
      activated: false,
      labels: ['测试草稿'],
    });

    view.rerender(<Harness active={false} />);
    await expect(activatePwaUpdateSafely(activate, { waitMs: 0 })).resolves.toMatchObject({ activated: true });
    view.unmount();
    expect(activate).toHaveBeenCalledTimes(1);
  });
});
