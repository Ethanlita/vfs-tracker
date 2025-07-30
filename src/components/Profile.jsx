import React, { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import EventForm from './EventForm';
import EventList from './EventList';
import { getEventsByUserId } from '../api';

/**
 * The user's profile page.
 * Displays a form to add new events and a timeline of the user's existing events.
 * @returns {JSX.Element} The rendered profile page.
 */
const Profile = () => {
  const { user } = useAuthenticator((context) => [context.user]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches the user's events from the backend and sorts them by date.
   */
  const fetchEvents = useCallback(async () => {
    if (user) {
      try {
        setIsLoading(true);
        const fetchedEvents = await getEventsByUserId(user.attributes.sub);
        // Sort events by date, newest first
        fetchedEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome, {user?.username}. Here you can add new events and view your timeline.
        </p>
      </div>

      <EventForm onEventAdded={handleEventAdded} />

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">My Timeline</h2>
        {isLoading ? <p>Loading events...</p> : <EventList events={events} />}
      </div>
    </div>
  );
};

export default Profile;
