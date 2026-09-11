/** @file 登录返回目标统一校验，避免外站跳转和认证循环。 */
import {it,expect} from 'vitest';
import {safeReturnUrl,profileSetupUrl} from '../../../src/routes/authReturn';
it.each(['/event-manager?audit=return#record','/docs?file=guide.md#标题','/','/quick-f0-test'])('保留有效目标 %s',value=>expect(safeReturnUrl(value)).toBe(value));
it.each([null,'','https://evil.test','//evil.test','/\\evil.test','/login?returnUrl=/login','/profile-setup-wizard','/unknown','/%2f/evil.test','/docs/../login','/docs\n'])('拒绝非法或循环目标 %s',value=>expect(safeReturnUrl(value)).toBe('/mypage'));
it('向导目标只编码一次，查询参数与锚点往返一致',()=>{const target='/event-manager?tag=a%20b#item';expect(new URLSearchParams(profileSetupUrl(target).split('?')[1]).get('returnUrl')).toBe(target)});
