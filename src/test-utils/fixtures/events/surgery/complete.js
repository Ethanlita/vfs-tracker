/**
 * @file Surgery 事件 - 完整数据
 */

export const completeSurgery = {
  userId: 'us-east-1:public-user-003',
  eventId: 'event_surgery_complete_001',
  type: 'surgery',
  date: '2025-03-15T10:00:00.000Z',
  status: 'approved',
  createdAt: '2025-03-15T18:30:00.000Z',
  updatedAt: '2025-03-15T18:30:00.000Z',
  details: {
    location: 'Yeson',
    doctor: '金亨泰',
    notes: '声带拉紧手术，术后恢复良好。',
  },
  attachments: [
    {
      fileUrl: 'attachments/us-east-1:public-user-003/event_surgery_complete_001/surgery_report.pdf',
      fileType: 'application/pdf',
      fileName: 'surgery_report.pdf',
    },
  ],
};

export const customDoctorSurgery = {
  userId: 'us-east-1:complete-user-001',
  eventId: 'event_surgery_custom_001',
  type: 'surgery',
  date: '2025-06-20T14:00:00.000Z',
  status: 'approved',
  createdAt: '2025-06-20T20:00:00.000Z',
  updatedAt: '2025-06-20T20:00:00.000Z',
  details: {
    location: '自定义',
    customLocation: '上海某三甲医院',
    doctor: '自定义',
    customDoctor: '赵医生',
    notes: '喉结缩小手术。',
  },
};
