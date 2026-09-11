/** @file 在 React 19 中订阅 XState 4 actor，避免引入不兼容的旧 React 绑定。 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { interpret } from 'xstate';
import { voiceTestMachine } from '../voice-test/voiceTestMachine.js';

/**
 * 创建并订阅嗓音测试 actor。
 * @param {(transition: {from: string, to: string, event: string}) => void} [onTransition] 转换观察器。
 * @returns {{state: import('xstate').State, send: Function}} actor 快照与事件入口。
 */
export function useVoiceTestActor(onTransition) {
  const observerRef = useRef(onTransition);
  observerRef.current = onTransition;
  const initialStateRef = useRef(voiceTestMachine.initialState);
  const actor = useMemo(() => interpret(voiceTestMachine, { devTools: import.meta.env.DEV }), []);
  const previousStateRef = useRef(voiceTestMachine.initialState.value);

  const subscribe = useCallback(notify => {
    const subscription = actor.subscribe(snapshot => {
      const previous = previousStateRef.current;
      const next = snapshot.value;
      if (snapshot.changed && previous !== next) {
        observerRef.current?.({ from: previous, to: next, event: snapshot.event.type });
        previousStateRef.current = next;
      }
      notify();
    });
    return () => subscription.unsubscribe();
  }, [actor]);
  const getSnapshot = useCallback(
    () => actor.status === 0 ? initialStateRef.current : actor.state,
    [actor]
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    actor.start();
    return () => actor.stop();
  }, [actor]);

  return { state, send: actor.send };
}
