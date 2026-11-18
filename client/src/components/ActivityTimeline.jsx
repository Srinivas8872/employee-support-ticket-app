import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import CategoryBadge from './CategoryBadge';
import {
  PlusCircle,
  ArrowRightCircle,
  Sliders,
  MessageSquare,
  Clock,
  User,
  Shield,
  Briefcase,
  Layers,
} from 'lucide-react';

export default function ActivityTimeline({ timeline, loading }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' or 'COMMENTS'

  const filteredItems =
    filter === 'COMMENTS'
      ? timeline.filter((item) => item.type === 'COMMENT' || item.activityType === 'COMMENTED')
      : timeline;

  const commentCount = timeline.filter(
    (item) => item.type === 'COMMENT' || item.activityType === 'COMMENTED'
  ).length;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm animate-pulse space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header with Filter Controls */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Activity Timeline &amp; Comments
            </h2>
            <p className="text-[11px] text-slate-500">
              Chronological audit trail of ticket creation, triage, status updates, and comments
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition ${
              filter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Activity ({timeline.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('COMMENTS')}
            className={`px-3 py-1 rounded-lg transition ${
              filter === 'COMMENTS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Comments ({commentCount})
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <p className="text-xs">
            {filter === 'COMMENTS'
              ? 'No comments have been posted to this ticket yet.'
              : 'No activity records found.'}
          </p>
        </div>
      ) : (
        /* Vertical Timeline Stream */
        <div className="p-6 sm:p-8">
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
            {filteredItems.map((item, index) => {
              const performer = item.performedBy || item.author;
              const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isComment = item.type === 'COMMENT' || item.activityType === 'COMMENTED';

              // 1. Comment Card
              if (isComment) {
                return (
                  <div key={item._id || index} className="relative pl-6">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-600 shadow-sm">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>

                    {/* Comment Bubble */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800">
                            {performer?.name || 'Unknown User'}
                          </span>
                          {performer?.role === 'Support' ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                              <Shield className="w-2.5 h-2.5 mr-0.5" />
                              Support
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                              <Briefcase className="w-2.5 h-2.5 mr-0.5" />
                              Employee
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formattedDate}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {item.content || item.details?.message}
                      </p>
                    </div>
                  </div>
                );
              }

              // 2. Created Event
              if (item.activityType === 'CREATED') {
                return (
                  <div key={item._id || index} className="relative pl-6">
                    <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-600 shadow-sm">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Ticket Created
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.details?.message || 'Ticket submitted with status Open'}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                        <span>by <strong>{performer?.name || 'Creator'}</strong></span>
                        <span>&bull;</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // 3. Status Changed Event
              if (item.activityType === 'STATUS_CHANGED') {
                return (
                  <div key={item._id || index} className="relative pl-6">
                    <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-amber-600 shadow-sm">
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          Status Advanced
                        </p>
                        <div className="flex items-center space-x-1.5">
                          {item.details?.previousValue && (
                            <>
                              <StatusBadge status={item.details.previousValue} />
                              <span className="text-slate-400 text-xs">&rarr;</span>
                            </>
                          )}
                          {item.details?.newValue && (
                            <StatusBadge status={item.details.newValue} />
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                        <span>by <strong>{performer?.name || 'Support'}</strong></span>
                        <span>&bull;</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // 4. Triaged Event
              if (item.activityType === 'TRIAGED') {
                return (
                  <div key={item._id || index} className="relative pl-6">
                    <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-purple-600 shadow-sm">
                      <Sliders className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Ticket Triaged
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.details?.message || 'Category or Priority updated'}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                        <span>by <strong>{performer?.name || 'Support'}</strong></span>
                        <span>&bull;</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
