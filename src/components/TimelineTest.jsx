import React from 'react';
import NewTimeline from './NewTimeline';

/**
 * TimelineTest
 *
 * This simple page renders the NewTimeline component with a static
 * set of mock events.  It is intended to test the timeline in
 * isolation without the surrounding dashboard elements.  Navigate
 * to `/timeline-test` in the application to view this test page.
 */
const TimelineTest = () => {
  // Define a small list of mock events mirroring the structure used
  // throughout the application. These events are used to demonstrate
  // various event types in the timeline component.
  const mockEvents = [
    {
      userId: 'mock-user-1',
      eventId: 'evt-001-selftest',
      type: 'self_test',
      date: '2024-05-01T09:00:00Z',
      createdAt: '2024-05-01T09:05:00Z',
      details: {
        appUsed: 'Voice Tools',
        sound: ['好'],
        voicing: ['没夹'],
        fundamentalFrequency: 185.5,
        notes: '感觉今天状态不错，声音很稳定。'
      }
    },
    {
      userId: 'mock-user-1',
      eventId: 'evt-002-hospitaltest',
      type: 'hospital_test',
      date: '2024-04-15T14:30:00Z',
      createdAt: '2024-04-15T15:00:00Z',
      details: {
        location: '市中心医院耳鼻喉科',
        equipmentUsed: 'KayPENTAX CSL',
        sound: ['喉咙中有痰'],
        voicing: ['有点夹'],
        fundamentalFrequency: 179.2,
        notes: '医生说有点声带水肿，建议多休息。'
      }
    },
    {
      userId: 'mock-user-1',
      eventId: 'evt-003-training',
      type: 'voice_training',
      date: '2024-05-05T18:00:00Z',
      createdAt: '2024-05-05T19:00:00Z',
      details: {
        trainingContent: 'SOVTEs, 半元音/m/ /n/发声练习',
        selfPracticeContent: '每天15分钟的SOVTEs',
        voiceStatus: '稳定，但高音区有点紧',
        voicing: '放松，核心支撑',
        feelings: '感觉对喉部肌肉的控制更好了。',
        instructor: '张老师'
      }
    },
    {
      userId: 'mock-user-1',
      eventId: 'evt-004-feeling',
      type: 'feeling_log',
      date: '2024-05-06T21:00:00Z',
      createdAt: '2024-05-06T21:05:00Z',
      details: {
        content: '今天和朋友聊天，他们说我的声音听起来自然多了，真的很开心！感觉所有的努力都值得了。'
      }
    }
  ];

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-rose-50 via-purple-50 to-blue-50">
      <h1 className="text-3xl font-bold mb-6 text-pink-600">时间轴测试页面</h1>
      <NewTimeline events={mockEvents} />
    </div>
  );
};

export default TimelineTest;