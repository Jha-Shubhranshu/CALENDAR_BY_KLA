import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarDay } from './CalendarDay';
import { ProjectFilter } from './ProjectFilter';
import { useCalendar } from '../hooksOG/useCalendar';
import type { ProjectDisplay } from '../typesOG/project.types';

interface CalendarProps {
  projects: ProjectDisplay[];
  onOpenConversation: (conversationId: string) => void;
  onOpenNote: (noteId: string) => void;
  onOpenProject: (projectId: string, messageId: string) => void;
}

export function Calendar({
  projects,
  onOpenConversation,
  onOpenNote,
  onOpenProject,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const { calendarData, loading, loadCalendarData, getActivityForDate } = useCalendar();

// Get start and end of current month
const monthStart = useMemo(() => {
  // ✅ Create date at midnight in local time
  return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
}, [currentDate]);

const monthEnd = useMemo(() => {
  // ✅ Last day of month at 23:59:59 local time
  return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
}, [currentDate]);

  // Load calendar data when month or filters change
  useEffect(() => {
    console.log('📅 Loading calendar data:', {
      monthStart: monthStart.toISOString().split('T')[0],
      monthEnd: monthEnd.toISOString().split('T')[0],
      selectedProjects: selectedProjects.length > 0 ? selectedProjects : undefined,
      currentDate: currentDate.toISOString().split('T')[0]
    });
    loadCalendarData(monthStart, monthEnd, selectedProjects.length > 0 ? selectedProjects : undefined);
  }, [monthStart, monthEnd, selectedProjects, loadCalendarData]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(new Date(monthStart.getTime() - (firstDayOfWeek - i) * 24 * 60 * 60 * 1000));
    }
    
    // Add all days of the month
    const daysInMonth = monthEnd.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    }
    
    // Add days from next month to complete the grid (6 weeks)
    while (days.length < 42) {
      const lastDay = days[days.length - 1];
      days.push(new Date(lastDay.getTime() + 24 * 60 * 60 * 1000));
    }
    
    return days;
  }, [monthStart, monthEnd, currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">{monthName}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Project Filter */}
        <ProjectFilter
          projects={projects}
          selectedProjects={selectedProjects}
          onSelectionChange={setSelectedProjects}
        />
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr min-h-full">
            {calendarDays.map((date, index) => {
              const activity = getActivityForDate(date);
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <CalendarDay
                  key={index}
                  date={date}
                  activity={activity}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                  selectedProjects={selectedProjects}
                  projects={projects}
                  onOpenConversation={onOpenConversation}
                  onOpenNote={onOpenNote}
                  onOpenProject={onOpenProject}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}