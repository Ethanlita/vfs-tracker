import React, { useState } from 'react';

/**
 * NewTimeline
 *
 * This component renders a horizontally scrolling timeline with paired
 * event and date cards.  Each event is represented by a dot on the
 * horizontal axis.  The event card appears above the axis and the
 * corresponding date card appears below the axis.  Both cards are
 * horizontally centred on a vertical symmetry axis passing through the
 * dot.  Cards have identical widths to maintain a pleasing rhythm
 * across the timeline.  Hovering an event card causes it to gently
 * elevate and scale, emphasising its interactive nature, and clicking
 * a card opens a modal with the full event details.  A small status
 * indicator beneath the timeline shows whether the data being
 * displayed originates from a real backend or is mock/demo data.
 *
 * The component accepts the following props:
 *
 *  - events: An array of event objects sorted in the desired order.
 *  - isProductionReady: A boolean or function returning a boolean to
 *    indicate whether the app is configured for a real backend.  If
 *    false, the timeline will indicate that it is displaying demo
 *    data.
 *  - isLoading: Optional boolean to indicate whether events are still
 *    loading.  When true, a loading indicator is shown instead of
 *    the timeline.
 */

// Internal component used to display the data source status.  This
// closely mirrors the styling used in VoiceFrequencyChart so the
// dashboard feels cohesive.  It displays a spinning bulb while
// loading, an orange triangle when using demo data and a green
// check‑circle when connected to the real backend.
const StatusIndicator = ({ isDemo, isLoading }) => {
    // Define simple inline SVGs for the icons.  Using inline icons
    // avoids pulling in additional dependencies from lucide-react.
    const Lightbulb = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
        </svg>
    );
    const AlertTriangle = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    );
    const CheckCircle = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
    return (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
            {isLoading ? (
                <span className="animate-spin text-yellow-500"><Lightbulb /></span>
            ) : isDemo ? (
                <span className="text-orange-500"><AlertTriangle /></span>
            ) : (
                <span className="text-green-500"><CheckCircle /></span>
            )}
            <span>{isLoading ? '加载中...' : isDemo ? '演示数据源' : '实时数据源'}</span>
        </div>
    );
};

const NewTimeline = ({ events = [], isProductionReady, isLoading = false }) => {
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Determine if we are in demo mode.  If isProductionReady is a function
    // call it, otherwise treat it as a boolean.
    const isDemo = !(typeof isProductionReady === 'function' ? isProductionReady() : isProductionReady);

    // Helper to format a date into a user friendly structure.  This
    // returns an object with month/day/year strings for use in the date
    // cards.  We rely on the browser locale (zh‑CN) to produce Chinese
    // month names in a consistent style.
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return {
            month: d.toLocaleDateString('zh-CN', { month: 'short' }),
            day: d.getDate(),
            year: d.getFullYear(),
        };
    };

    // Derive a simple summary from the event.  If the event has a
    // `summary` property use it; otherwise attempt to derive from the
    // `details.content` or `details.notes`.  This fallback ensures each
    // card has something meaningful to display without overflowing.
    const getSummary = (event) => {
        if (event.summary) return event.summary;
        if (event.details) {
            if (event.details.content) return event.details.content.slice(0, 50) + (event.details.content.length > 50 ? '…' : '');
            if (event.details.notes) return event.details.notes.slice(0, 50) + (event.details.notes.length > 50 ? '…' : '');
        }
        return '无摘要';
    };

    // Configuration for different event types, mapping to emoji and
    // descriptive labels.  Should additional event types be added in
    // future, extend this object accordingly.
    const typeConfig = {
        hospital_test: { label: '医院检测', icon: '🏥' },
        self_test: { label: '自我测试', icon: '📱' },
        voice_training: { label: '嗓音训练', icon: '🎯' },
        self_practice: { label: '自我练习', icon: '✍️' },
        surgery: { label: '手术', icon: '⚕️' },
        feeling_log: { label: '感受记录', icon: '😊' },
    };

    // Handle closing of the modal when clicking the overlay or the close
    // button.  When closing, reset selectedEvent to null.
    const closeModal = () => setSelectedEvent(null);

    // If we are still loading, show a placeholder with spinner.  This
    // prevents flashes of empty timeline when data is on the way.
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-pink-500"></div>
                <span className="text-md text-gray-600 font-medium">正在加载事件...</span>
            </div>
        );
    }

    // When no events exist, show a friendly prompt encouraging the user
    // to add their first entry.  Use emojis and colours to maintain
    // consistency with the rest of the dashboard.
    if (!events || events.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
                <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
            </div>
        );
    }

    return (
        <div className="relative w-full pt-12 pb-8" style={{ minHeight: '30rem' }}>
            {/* Horizontal timeline axis */}
            <div
                className="absolute left-0 right-0 top-1/2 border-t border-gray-400 z-0"
                style={{ transform: 'translateY(-50%)' }}
            ></div>
            {/* Events container laid out horizontally */}
            <div className="flex overflow-x-auto space-x-20 px-8 snap-x snap-mandatory">
                {events.map((event) => {
                    const cfg = typeConfig[event.type] || { label: event.type, icon: '📌' };
                    const dateInfo = formatDate(event.date || event.createdAt);
                    return (
                        <div
                            key={event.eventId}
                            className="relative flex-shrink-0 flex flex-col items-center snap-center space-y-2"
                            style={{ width: '18rem' }}
                        >
                            {/* Event card */}
                            <div
                                onClick={() => setSelectedEvent(event)}
                                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.05] hover:shadow-3xl z-10"
                                style={{ width: '16rem', height: '10rem' }}
                            >
                                <div className="flex items-center mb-2 space-x-2">
                                    <span className="text-xl">{cfg.icon}</span>
                                    <h3 className="text-sm font-bold text-gray-800 truncate">{cfg.label}</h3>
                                </div>
                                <div className="border-t border-dashed border-gray-300 my-1"></div>
                                {/* Summary: scrollable area if content is long */}
                                <p
                                    className="text-xs text-gray-600 leading-snug overflow-y-auto"
                                    title={getSummary(event)}
                                    style={{ maxHeight: '6rem' }}
                                >
                                    {getSummary(event)}
                                </p>
                            </div>
                            {/* Dot and connector */}
                            <div className="flex flex-col items-center">
                                <div
                                    className="bg-pink-500 border-2 border-white rounded-full shadow-md"
                                    style={{ width: '0.75rem', height: '0.75rem' }}
                                ></div>
                                <div
                                    className="bg-gray-300"
                                    style={{ width: '1px', height: '1rem' }}
                                ></div>
                            </div>
                            {/* Date card */}
                            <div
                                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 flex flex-col items-center justify-center p-4 z-10 transition-all duration-300 ease-out hover:shadow-3xl"
                                style={{ width: '10rem', height: '5rem' }}
                            >
                                <span className="text-lg font-bold text-gray-800">{dateInfo.year} {dateInfo.month}{dateInfo.day}日</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Status indicator */}
            <div className="mt-6 flex justify-end px-8">
                <StatusIndicator isDemo={isDemo} isLoading={isLoading} />
            </div>
            {/* Modal for event details */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={closeModal}
                    ></div>
                    {/* Modal content */}
                    <div className="relative z-10 max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 m-4 overflow-y-auto max-h-[80vh]">
                        {/* Close button */}
                        <button
                            onClick={closeModal}
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                        {/* Header */}
                        <div className="flex items-center space-x-3 mb-4">
                            <span className="text-3xl">{(typeConfig[selectedEvent.type] || {}).icon || '📌'}</span>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{(typeConfig[selectedEvent.type] || {}).label || selectedEvent.type}</h3>
                                <p className="text-xs text-gray-500">{new Date(selectedEvent.date || selectedEvent.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                        {/* Body */}
                        {selectedEvent.details ? (
                            <pre className="whitespace-pre-wrap text-sm text-gray-700">{JSON.stringify(selectedEvent.details, null, 2)}</pre>
                        ) : (
                            <p className="text-sm text-gray-600">没有详细信息可用。</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewTimeline;