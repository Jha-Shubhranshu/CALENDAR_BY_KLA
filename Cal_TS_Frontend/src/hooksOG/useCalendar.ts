import { useState, useCallback } from 'react';
import { getCalendarActivity, type CalendarData, type DateActivity } from '../api/calendarAPIAxios';

export function useCalendar() {
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCalendarData = useCallback(async (
    startDate: Date,
    endDate: Date,
    projectIds?: string[]
  ) => {
    try {
      setLoading(true);
      const data = await getCalendarActivity(startDate, endDate, projectIds);
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      // Set empty calendar data on error to prevent infinite loading
      setCalendarData({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        days: []
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const getActivityForDate = useCallback((date: Date): DateActivity | null => {
    if (!calendarData) return null;
    
    const dateStr = date.toISOString().split('T')[0];
    return calendarData.days.find(d => d.date === dateStr) || null;
  }, [calendarData]);

  return {
    calendarData,
    loading,
    loadCalendarData,
    getActivityForDate,
  };
}