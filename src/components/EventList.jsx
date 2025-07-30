import React from 'react';
import { Storage } from 'aws-amplify';

/**
 * Renders a list of events in a vertical timeline format.
 * @param {object} props - The component props.
 * @param {Array<object>} props.events - An array of event objects to display.
 * @returns {JSX.Element} The rendered list of events.
 */
const EventList = ({ events }) => {
  if (!events || events.length === 0) {
    return <p className="text-gray-500">No events found. Add one using the form above!</p>;
  }

  /**
   * Handles downloading an S3 attachment.
   * It gets a temporary, pre-signed URL from S3 and opens it in a new tab.
   * @param {string} attachmentKey - The S3 key for the file to download.
   */
  const handleDownload = async (attachmentKey) => {
    try {
      // The `download: true` option forces the browser to download the file instead of displaying it.
      const url = await Storage.get(attachmentKey, { download: true });
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error downloading file from S3:', error);
      alert('Could not download file.');
    }
  };

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.eventId}>
            <div className="relative pb-8">
              {/* Render a vertical line connecting timeline points, except for the last one */}
              {eventIdx !== events.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-pink-500 flex items-center justify-center ring-8 ring-white">
                    {/* TODO: This icon could be changed based on event.type */}
                    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      {event.type.replace('_', ' ').toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-800 mt-1">{event.notes || 'No notes provided.'}</p>
                    {event.attachment && (
                      <button
                        onClick={() => handleDownload(event.attachment)}
                        className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Download Attachment
                      </button>
                    )}
                  </div>
                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                    <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString()}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EventList;
