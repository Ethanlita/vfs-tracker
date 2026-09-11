/** @file 嗓音测试步骤的唯一配置源。 */

/**
 * 定义每个步骤的显示内容与完成条件，状态机和界面共同读取此配置。
 */
export const VOICE_TEST_STEPS = [
  { id: 0, state: 'consent', title: '说明与同意', instructions: '本工具旨在提供嗓音分析的参考数据，并非医疗诊断。您的数据将被匿名化处理，仅能用于参考。' +
          '\n过程需要约10分钟。已上传片段、量表和分析会话会在当前账号下保留60分钟；刷新或返回后可以继续。尚未上传的原始录音只会临时保存在本浏览器中，到期后自动失效。' +
          '\n这不仅会浪费您的时间，也会占用额外的AWS Lambda运行时和S3存储空间。' +
          '\n每次您完成一个片段的录音后，请点击“停止录音且继续”，这样录音才会停止并自动上传。如本段说错或失误，可点击“停止录音且放弃”丢弃本段并重新录制。' +
          '\n上传的音频文件只会在S3中保留60分钟，因此，请务必在60分钟内完成测试，否则将会产生不可预知的测试结果。' +
          '\n如果您准备好了，点击“下一步”即表示您同意以上条款。', requiresRecording: false },
  { id: 1, state: 'calibration', title: '设备与环境校准', instructions: '请在安静的环境中进行测试。首先，录制5秒钟的静音。然后，用正常音量朗读“他去无锡市，我到黑龙江”两遍。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['点击开始录音，保持安静5秒，然后请点击停止', '点击开始录音，朗读标准句，然后点击停止'] },
  { id: 2, state: 'sustainedVowel', title: '最长发声时 (MPT) + 稳定元音', instructions: '请用舒适的音量，尽可能长地发出元音 /a/。此步骤需要录制两次，我们会取效果最好的一次。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['第一次 /a/ （啊）发声，录制完成后请点击停止', '第二次 /a/ （啊）发声，录制完成后请点击停止'] },
  { id: 3, state: 'glide', title: '音域测定：滑音', instructions: '请从您最低的音平滑地唱到最高的音（上滑音），然后从最高的音平滑地唱到最低的音（下滑音）。上下滑音各需录制两次。' +
          '\n提示：滑音，即选择一个元音（如“/a/ (啊)”或“/u/ (呜)”），从自己舒适的中音开始，把声音顺滑地持续拉高到能达到的最高音（上滑音），再连续滑回最低音（下滑音）。' +
          '\n要求连贯不中断、不突然跳音，用来测试声音能覆盖的最高与最低范围，也就是音域极限。', requiresRecording: true, recordingsNeeded: 4, recordingLabels: ['第一次上滑音，录制完成后请点击停止', '第二次上滑音，录制完成后请点击停止', '第一次下滑音，录制完成后请点击停止', '第二次下滑音，录制完成后请点击停止'] },
  { id: 4, state: 'formant', title: '定点音 + 共振峰', instructions: '请分别用您最低和最高的可控音量，稳定地发出元音 /a/，各持续3-4秒。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['最低音 /a/，录制完成后请点击停止', '最高音 /a/，录制完成后请点击停止'] },
  { id: 5, state: 'reading', title: '朗读指定语句', instructions: '请按屏幕上显示的文字进行朗读。', requiresRecording: true, recordingsNeeded: 1 },
  { id: 6, state: 'freeSpeech', title: '自由说话', instructions: '请围绕开放话题“介绍一下你最喜欢的食物”进行30-60秒的自由发言。', requiresRecording: true, recordingsNeeded: 1 },
  { id: 7, state: 'survey', title: '主观量表', instructions: '请根据您近期的嗓音情况，完成以下主观评估量表。', requiresRecording: false },
  { id: 8, state: 'report', title: '结果确认与报告生成', instructions: '所有测试已完成！请点击下方按钮，开始生成您的嗓音分析报告。', requiresRecording: false },
];

export const VOICE_TEST_STEP_BY_STATE = Object.fromEntries(
  VOICE_TEST_STEPS.map(step => [step.state, step])
);

/** 返回全新的量表初始值，避免不同会话共享数组引用。 */
export const createEmptyVoiceTestForm = () => ({
  rbh: { R: null, B: null, H: null },
  ovhs9: Array(9).fill(null),
  tvqg: Array(12).fill(null),
});
