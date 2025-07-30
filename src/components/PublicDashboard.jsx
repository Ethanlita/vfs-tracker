import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getAllEvents } from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PublicDashboard = () => {
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        setIsLoading(true);
        const allEvents = await getAllEvents();
        setTotalEvents(allEvents.length);
        const uniqueUsers = new Set(allEvents.map(event => event.userId));
        setTotalUsers(uniqueUsers.size);

        const eventTypes = ['hospital_test', 'self_test', 'training', 'surgery'];
        const counts = eventTypes.reduce((acc, type) => {
          acc[type] = allEvents.filter(event => event.type === type).length;
          return acc;
        }, {});

        setChartData({
          labels: eventTypes.map(type => type.replace('_', ' ').toUpperCase()),
          datasets: [
            {
              label: '# of Events',
              data: eventTypes.map(type => counts[type]),
              backgroundColor: 'rgba(236, 72, 153, 0.6)', // Pink color
              borderColor: 'rgba(236, 72, 153, 1)',
              borderWidth: 1,
            },
          ],
        });
      } catch (error) {
        console.error("Failed to fetch public data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  if (isLoading) {
    return <div className="text-center p-8">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Public Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          A summary of anonymized data from all users.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-500">Total Events Logged</h3>
          <p className="mt-2 text-4xl font-bold text-indigo-600">{totalEvents}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-500">Contributing Users</h3>
          <p className="mt-2 text-4xl font-bold text-pink-600">{totalUsers}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Distribution</h2>
        {chartData ? (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title: { display: true, text: 'Distribution of Event Types Across All Users' },
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }}
          />
        ) : (
          <p>No chart data available.</p>
        )}
      </div>
    </div>
  );
};

export default PublicDashboard;
