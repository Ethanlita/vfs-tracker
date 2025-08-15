import React, { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import EventForm from './EventForm';
import EventList from './EventList';
import { getEventsByUserId } from '../api';
import { useAsync } from '../utils/useAsync.js';
import { isProductionReady as globalIsProductionReady } from '../env.js';

/**
 * The user's profile page.
 * Displays a form to add new events and a timeline of the user's existing events.
 * @returns {JSX.Element} The rendered profile page.
 */
const Profile = () => {
  const productionReady = globalIsProductionReady();

  // 条件性使用认证
  const authenticatorContext = productionReady ? useAuthenticator((context) => [context.user]) : null;
  const user = authenticatorContext?.user || {
    attributes: {
      email: 'demo@example.com',
      sub: 'demo-user-123'
    }
  };

  const [events, setEvents] = useState([]);
  const eventsAsync = useAsync(async () => {
    if (!user?.attributes?.sub) return [];
    const fetched = await getEventsByUserId(user.attributes.sub);
    return fetched.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  }, [user?.attributes?.sub]);
  useEffect(()=>{ if(eventsAsync.value) setEvents(eventsAsync.value); },[eventsAsync.value]);
  const isLoading = eventsAsync.loading;
  const loadError = eventsAsync.error;

  /**
   * Callback function passed to EventForm.
   * Adds the newly created event to the top of the events list without needing a full refetch.
   * @param {object} newEvent The event object returned from the API.
   */
  const handleEventAdded = (newEvent) => {
    // Add the new event to the top of the list to maintain sort order
    setEvents(prevEvents => [newEvent, ...prevEvents]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">我的资料</h1>
        <p className="mt-1 text-sm text-gray-500">
          欢迎，{user?.username}。在这��您可以添加新事件并查看您的时间线。
        </p>
      </div>

      <EventForm onEventAdded={handleEventAdded} />

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">我的时间线</h2>
        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <p className="font-semibold mb-2">加载事件失败</p>
            <p className="mb-3">{loadError.message || '未知错误'}</p>
            <button onClick={eventsAsync.execute} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs">重试</button>
          </div>
        )}
        {isLoading ? <p>正在加载事件...</p> : (!events.length ? <p className="text-gray-500">暂无事件</p> : <EventList events={events} />)}
      </div>
    </div>
  );
};

export default Profile;
