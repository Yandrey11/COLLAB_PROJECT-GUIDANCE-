import { useState, useMemo } from "react";

export default function CalendarView({ calendarEvents = [], records = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Get the month and year to display
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Month names
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper function to format date as YYYY-MM-DD (normalizes to local timezone)
  const formatDateKey = (date) => {
    if (!date) return null;
    const d = new Date(date);
    // Use local date to avoid timezone issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Group records by date
  const recordsByDate = useMemo(() => {
    const grouped = {};
    records.forEach(record => {
      if (record.date) {
        try {
          const dateKey = formatDateKey(record.date);
          if (dateKey) {
            if (!grouped[dateKey]) {
              grouped[dateKey] = [];
            }
            grouped[dateKey].push(record);
          }
        } catch (error) {
          console.error("Error formatting record date:", error, record);
        }
      }
    });
    return grouped;
  }, [records]);

  // Group calendar events by date
  const eventsByDate = useMemo(() => {
    const grouped = {};
    calendarEvents.forEach(event => {
      if (event.start) {
        const eventDate = new Date(event.start);
        const dateKey = formatDateKey(eventDate);
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      }
    });
    return grouped;
  }, [calendarEvents]);

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  // Get records and events for a specific date
  const getDateData = (date) => {
    if (!date) return { records: [], events: [] };
    const dateKey = formatDateKey(date);
    return {
      records: recordsByDate[dateKey] || [],
      events: eventsByDate[dateKey] || [],
    };
  };

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm text-gray-700 dark:text-gray-300 font-semibold"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="text-center">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {monthNames[month]} {year}
          </h3>
          <button
            onClick={goToToday}
            className="mt-1 px-3 py-1 rounded-lg bg-indigo-600 dark:bg-indigo-600 text-white dark:text-white hover:bg-indigo-700 dark:hover:bg-indigo-700 text-[10px] font-semibold transition-colors"
          >
            Go to Today
          </button>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm text-gray-700 dark:text-gray-300 font-semibold"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-gray-600 dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateData = getDateData(date);
          const hasRecords = dateData.records.length > 0;
          const hasEvents = dateData.events.length > 0;
          const isSelected = selectedDate && formatDateKey(selectedDate) === formatDateKey(date);
          const today = isToday(date);

          return (
            <div
              key={formatDateKey(date)}
              onClick={() => setSelectedDate(date)}
              className={`min-h-[75px] border rounded-lg p-1.5 cursor-pointer transition-all hover:shadow-md flex flex-col ${
                today
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600"
                  : isSelected
                  ? "border-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-500"
                  : hasRecords || hasEvents
                  ? "border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
              }`}
            >
              <div className={`text-xs font-bold mb-0.5 ${
                today ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"
              }`}>
                {date.getDate()}
              </div>
              
              {/* Show records (client names) and events inside the date */}
              <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
                {hasRecords && dateData.records.map((record, idx) => {
                  const statusColors = {
                    Completed: "bg-emerald-500",
                    Ongoing: "bg-amber-500",
                    Referred: "bg-purple-500",
                  };
                  const bgColor = statusColors[record.status] || "bg-orange-500";
                  
                  return (
                    <div
                      key={record._id || idx}
                      className={`text-[10px] leading-tight ${bgColor} text-white rounded px-1.5 py-0.5 font-semibold truncate`}
                      title={`${record.clientName} - ${record.sessionType || "General Counseling"} (${record.status || "Ongoing"})`}
                    >
                      {record.clientName}
                    </div>
                  );
                })}
                {hasEvents && dateData.events.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="text-[10px] leading-tight bg-blue-500 text-white rounded px-1.5 py-0.5 font-semibold truncate"
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (() => {
        const dateData = getDateData(selectedDate);
        const totalItems = dateData.records.length + dateData.events.length;
        
        if (totalItems === 0) return null;

        return (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h4>
            
            <div className="space-y-3">
              {/* Counseling Records */}
              {dateData.records.map((record) => {
                const recordDate = new Date(record.date);
                const statusColors = {
                  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
                  Ongoing: "bg-amber-100 text-amber-700 border-amber-200",
                  Referred: "bg-purple-100 text-purple-700 border-purple-200",
                };
                const statusClass = statusColors[record.status] || "bg-slate-100 text-slate-600 border-slate-200";
                
                return (
                  <div
                    key={record._id}
                    className={`p-3 rounded-lg border ${statusClass}`}
                  >
                    <div className="font-semibold text-sm mb-1">
                      {record.clientName}
                    </div>
                    <div className="text-xs opacity-80">
                      {record.sessionType || "General Counseling"} • Session {record.sessionNumber || 1}
                    </div>
                    {recordDate && (
                      <div className="text-xs opacity-70 mt-1">
                        {recordDate.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Google Calendar Events */}
              {dateData.events.map((event) => {
                const startDate = new Date(event.start);
                const isAllDay = !event.start.includes("T");
                
                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                  >
                    <div className="font-semibold text-sm mb-1 text-blue-900 dark:text-blue-200">
                      {event.title}
                    </div>
                    {event.description && (
                      <div className="text-xs text-blue-700 dark:text-blue-300 mb-1 line-clamp-2">
                        {event.description}
                      </div>
                    )}
                    {!isAllDay && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {startDate.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                    {event.location && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

