/** @file 嗓音测试步骤状态机：集中约束前进、后退、跳过、恢复与重置。 */
import { createMachine } from 'xstate';
import { VOICE_TEST_STEPS } from './voiceTestSteps.js';

const stateNames = VOICE_TEST_STEPS.map(step => step.state);

/** 根据目标步骤生成恢复分支，非法索引不会改变当前状态。 */
const restoreTransitions = VOICE_TEST_STEPS.map(step => ({
  target: step.state,
  cond: (_context, event) => event.step === step.id,
}));

const states = Object.fromEntries(VOICE_TEST_STEPS.map((step, index) => {
  const on = {
    GO_TO: restoreTransitions,
    RESET: stateNames[0],
  };
  if (index > 0) on.BACK = stateNames[index - 1];
  if (index < VOICE_TEST_STEPS.length - 1) {
    on.NEXT = { target: stateNames[index + 1], cond: (_context, event) => event.complete === true };
  }
  if (step.state === 'survey') on.SKIP = 'report';
  return [step.state, { on }];
}));

/**
 * 有限状态机是步骤位置的唯一真实来源；业务数据仍由相应服务 hook 管理。
 */
export const voiceTestMachine = createMachine({
  id: 'voiceTestWizard',
  predictableActionArguments: true,
  initial: stateNames[0],
  states,
});

/** 将状态机快照转换为现有步骤索引。 */
export const getVoiceTestStep = state => (
  VOICE_TEST_STEPS.find(step => step.state === state.value) || VOICE_TEST_STEPS[0]
);
