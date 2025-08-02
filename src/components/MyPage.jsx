import React, { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getEventsForUser } from '../api';
import EventForm from './EventForm';
import EventList from './EventList';

/**
 * @en The MyPage component serves as the user's personal dashboard. It fetches,
 * displays, and manages the user's voice events. It includes a form to add new
 * events and a timeline to view existing ones.
 * @zh MyPage 组件作为用户的个人仪表板。它获取、显示和管理用户的嗓音事件。
 * 它包括一个用于添加新事件的表单和一个用于查看现有事件的时间线。
 * @returns {JSX.Element} The rendered personal dashboard page.
 */
const MyPage = () => {
  // --- STATE MANAGEMENT ---
  // @en Get the authenticated user object.
  // @zh 获取经过身份验证的用户对象。
  const { user } = useAuthenticator((context) => [context.user]);
  // @en State for storing the list of user events.
  // @zh 用于存储用户事件列表的状态。
  const [events, setEvents] = useState([]);
  // @en State to manage the loading status while fetching data.
  // @zh 用于在获取数据时管理加载状态的状态。
  const [isLoading, setIsLoading] = useState(true);

  // --- DATA FETCHING ---
  /**
   * @en Fetches events for the current user from the API. It sorts the events
   * by creation date in descending order.
   * @zh 从 API 中为当前用户获取事件。它按创建日期降序对事件进行排序。
   */
  const fetchEvents = useCallback(async () => {
    if (!user) return; // @en Don't fetch if there's no user. @zh 如果没有用户则不获取。
    try {
      setIsLoading(true);
      const userEvents = await getEventsForUser();
      // @en Sort events by creation date, newest first.
      // @zh 按创建日期对事件进行排序，最新的在前。
      const sortedEvents = userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEvents(sortedEvents);
    } catch (error) {
      console.error("Failed to fetch user events:", error);
      alert("Could not load your events. Please try reloading the page.");
    } finally {
      setIsLoading(false);
    }
  }, [user]); // @en Dependency: refetch if the user object changes. @zh 依赖：如果 user 对象发生变化则重新获取。

  // --- EFFECTS ---
  // @en Effect to trigger fetching events when the component mounts or fetchEvents changes.
  // @zh 在组件挂载或 fetchEvents 变化时触发获取事件的 Effect。
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // --- HANDLERS ---
  /**
   * @en Callback function passed to EventForm. It adds a newly created event
   * to the top of the events list to update the UI instantly.
   * @zh 传递给 EventForm 的回调函数。它将新创建的事件添加到事件列表的顶部，以立即更新 UI。
   * @param {object} newEvent - The new event object returned from the API.
   */
  const handleEventAdded = (newEvent) => {
    // @en Add the new event to the top of the list for immediate UI feedback.
    // @zh 将新事件添加到列表顶部，以获得即时的 UI 反馈。
    setEvents(prevEvents => [newEvent, ...prevEvents]);
  };

  // --- RENDER ---
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Personal Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {/* @en Greet the user by their email. @zh 通过用户的电子邮件向他们打招呼。 */}
          Welcome, {user?.attributes?.email || 'user'}! Here you can log and view your voice events.
        </p>
      </div>

      {/* @en The form for adding new events. @zh 用于添加新事件的表单。 */}
      <EventForm onEventAdded={handleEventAdded} />

      {/* @en Container for the user's event timeline. @zh 用户事件时间线的容器。 */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold mb-4">My Event Timeline</h2>
        {isLoading ? (
          <p>Loading events...</p>
        ) : (
          <EventList events={events} />
        )}
      </div>
    </div>
  );
};

export default MyPage;
