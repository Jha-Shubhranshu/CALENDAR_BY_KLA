import React, { useState, useRef } from 'react';
import { DateActivityPopup } from './modals/DateActivityPopup';
import type { DateActivity } from '../api/calendarAPIAxios';
import type { ProjectDisplay } from '../typesOG/project.types';


interface CalendarDayProps {
  date: Date;
  activity: DateActivity | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  selectedProjects: string[];
  projects: ProjectDisplay[];
  onOpenConversation: (conversationId: string) => void;
  onOpenNote: (noteId: string) => void;
  onOpenProject: (projectId: string, messageId: string) => void;
}

export function CalendarDay({
  date,
  activity,
  isCurrentMonth,
  isToday,
  selectedProjects,
  projects,
  onOpenConversation,
  onOpenNote,
  onOpenProject,
}: CalendarDayProps) {
  const [showPopup, setShowPopup] = useState(false);
  const dayRef = useRef<HTMLDivElement>(null);

  // Check if this day has activity from selected projects
  const hasSelectedProjectActivity = activity?.projects.some(p => 
    selectedProjects.includes(p.project_id)
  );

  // Get highlight colors from projects
  const highlightColors = activity?.projects
    .filter(p => selectedProjects.length === 0 || selectedProjects.includes(p.project_id))
    .map(p => p.project_color) || [];

  // Generate gradient background if multiple projects
  const getHighlightStyle = (): React.CSSProperties => {
    if (highlightColors.length === 0) return {};
    
    if (highlightColors.length === 1) {
      return {
        backgroundColor: `${highlightColors[0]}20`, // 20 = 12.5% opacity
        borderLeft: `3px solid ${highlightColors[0]}`,
      };
    }
    
    // Multiple projects - create gradient
    const gradient = `linear-gradient(135deg, ${highlightColors.map((color, i) => 
      `${color}30 ${(i / highlightColors.length) * 100}%, ${color}30 ${((i + 1) / highlightColors.length) * 100}%`
    ).join(', ')})`;
    
    return {
      background: gradient,
      borderLeft: `3px solid ${highlightColors[0]}`,
    };
  };

  const hasActivity = activity && (
    activity.notebooks.claude.count > 0 ||
    activity.notebooks.chatgpt.count > 0 ||
    activity.notebooks.notes.count > 0 ||
    activity.projects.length > 0
  );

  return (
    <div
      ref={dayRef}
      className={`
        border-r border-b border-gray-200 p-1 min-h-[60px] relative
        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}
        ${hasActivity ? 'cursor-pointer' : ''}
        transition-colors
      `}
      style={hasSelectedProjectActivity || (selectedProjects.length === 0 && highlightColors.length > 0) ? getHighlightStyle() : {}}
      onMouseEnter={() => hasActivity && setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Date Number */}
      <div className="flex items-start justify-between">
        <span className={`
          text-xs font-medium
          ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}
          ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
        `}>
          {date.getDate()}
        </span>

        {/* Activity Indicator Dots */}
        {hasActivity && (
          <div className="flex gap-0.5">
            {activity.notebooks.claude.count > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Claude conversations" />
            )}
            {activity.notebooks.chatgpt.count > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-gray-700" title="ChatGPT conversations" />
            )}
            {activity.notebooks.notes.count > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Notes" />
            )}
          </div>
        )}
      </div>

      {/* Hover Popup */}
      {showPopup && activity && (
        <DateActivityPopup
          date={date}
          activity={activity}
          anchorRef={dayRef}
          projects={projects}
          onOpenConversation={onOpenConversation}
          onOpenNote={onOpenNote}
          onOpenProject={onOpenProject}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}