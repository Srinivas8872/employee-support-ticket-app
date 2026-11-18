import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import CategoryBadge from './CategoryBadge';
import { Clock, User, ChevronRight } from 'lucide-react';

export default function TicketCard({ ticket }) {
  const shortId = ticket._id ? ticket._id.slice(-6).toUpperCase() : '';
  const formattedDate = new Date(ticket.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      to={`/tickets/${ticket._id}`}
      className="block bg-white p-4 sm:p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: ID, Title & Metadata */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              #{shortId}
            </span>
            <CategoryBadge category={ticket.category} />
            <PriorityBadge priority={ticket.priority} />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
            {ticket.title}
          </h3>

          <div className="flex items-center text-xs text-slate-500 space-x-4 pt-0.5">
            {ticket.createdBy && (
              <span className="inline-flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span className="truncate max-w-[150px]">
                  {ticket.createdBy.name || 'Unknown User'}
                </span>
              </span>
            )}
            <span className="inline-flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Right: Status badge & Arrow */}
        <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <StatusBadge status={ticket.status} />
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </Link>
  );
}
