import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import CategoryBadge from '../components/CategoryBadge';
import ActivityTimeline from '../components/ActivityTimeline';
import CommentForm from '../components/CommentForm';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Shield,
  PlayCircle,
  CheckCircle,
  Archive,
  Lock,
  Sliders,
} from 'lucide-react';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

// Strict linear status transition map (Support only)
const NEXT_STATUS_MAP = {
  Open: {
    next: 'In Progress',
    label: 'Start Progress',
    Icon: PlayCircle,
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  'In Progress': {
    next: 'Resolved',
    label: 'Mark as Resolved',
    Icon: CheckCircle,
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  Resolved: {
    next: 'Closed',
    label: 'Close Ticket',
    Icon: Archive,
    btnClass: 'bg-slate-700 hover:bg-slate-800 text-white',
  },
  Closed: null, // Final state: no further transitions permitted
};

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  // Timeline State
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // Support Triage Form State
  const [triageCategory, setTriageCategory] = useState('');
  const [triagePriority, setTriagePriority] = useState('');
  const [triageSubmitting, setTriageSubmitting] = useState(false);
  const [triageMessage, setTriageMessage] = useState(null);
  const [triageError, setTriageError] = useState(null);

  // Status Action State
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const isSupport = user?.role === 'Support';

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const response = await ticketApi.getTicketById(id);
      if (response.data && response.data.success) {
        const ticketData = response.data.data;
        setTicket(ticketData);
        setTriageCategory(ticketData.category);
        setTriagePriority(ticketData.priority);
      } else {
        throw new Error('Failed to load ticket details');
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
        setForbidden(true);
      } else if (err.response && err.response.status === 404) {
        setError('Ticket not found.');
      } else {
        setError(
          err.response?.data?.message ||
          'Failed to load ticket details. Please check your network connection.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const response = await ticketApi.getTimeline(id);
      if (response.data && response.data.success) {
        setTimeline(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
    fetchTimeline();
  }, [fetchTicket, fetchTimeline]);

  // Support Triage Handler
  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    setTriageError(null);
    setTriageMessage(null);

    // Guard: Triage allowed only in Open or In Progress
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      setTriageError('Triage locked: Tickets in Resolved or Closed status cannot be modified.');
      return;
    }

    if (triageCategory === ticket.category && triagePriority === ticket.priority) {
      setTriageMessage('No changes made to triage fields.');
      return;
    }

    setTriageSubmitting(true);
    try {
      const response = await ticketApi.triageTicket(ticket._id, {
        category: triageCategory,
        priority: triagePriority,
      });

      if (response.data && response.data.success) {
        const updated = response.data.data;
        setTicket(updated);
        setTriageCategory(updated.category);
        setTriagePriority(updated.priority);
        setTriageMessage('Category and priority updated successfully.');
        // Refresh timeline to reflect new TRIAGED event
        fetchTimeline();
      }
    } catch (err) {
      setTriageError(
        err.response?.data?.message ||
        'Unable to update triage fields. Please try again.'
      );
    } finally {
      setTriageSubmitting(false);
    }
  };

  // Support Status Transition Handler
  const handleStatusAdvance = async () => {
    const nextConfig = NEXT_STATUS_MAP[ticket.status];
    if (!nextConfig) return;

    setStatusSubmitting(true);
    setStatusError(null);
    setStatusMessage(null);

    try {
      const response = await ticketApi.updateStatus(ticket._id, nextConfig.next);
      if (response.data && response.data.success) {
        const updated = response.data.data;
        setTicket(updated);
        setStatusMessage(`Ticket advanced to "${updated.status}".`);
        // Refresh timeline to reflect new STATUS_CHANGED event
        fetchTimeline();
      }
    } catch (err) {
      setStatusError(
        err.response?.data?.message ||
        'Failed to advance ticket status. Please try again.'
      );
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Loading View
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm font-medium">Loading ticket details...</p>
      </div>
    );
  }

  // 403 Forbidden View (Employee attempting to access another user's ticket)
  if (forbidden) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          You do not have permission to view this ticket. Employees are restricted to viewing only tickets they created.
        </p>
        <Link
          to="/tickets"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to My Tickets
        </Link>
      </div>
    );
  }

  // Error / Not Found View
  if (error || !ticket) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Ticket Not Found</h2>
        <p className="text-xs text-slate-600 mb-6">{error || 'The requested ticket does not exist.'}</p>
        <Link
          to="/tickets"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Tickets
        </Link>
      </div>
    );
  }

  const shortId = ticket._id ? ticket._id.slice(-6).toUpperCase() : '';
  const createdDate = new Date(ticket.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const updatedDate = new Date(ticket.updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const nextStatusConfig = NEXT_STATUS_MAP[ticket.status];
  const isTriageAllowed = isSupport && (ticket.status === 'Open' || ticket.status === 'In Progress');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Return Navigation */}
      <Link
        to="/tickets"
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
        Back to Tickets
      </Link>

      {/* Main Ticket Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Ticket Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                #{shortId}
              </span>
              <CategoryBadge category={ticket.category} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <StatusBadge status={ticket.status} size="lg" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
            {ticket.title}
          </h1>

          <div className="flex flex-wrap items-center text-xs text-slate-500 gap-y-1 gap-x-4">
            <div className="flex items-center">
              <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>Created by </span>
              <strong className="text-slate-700 ml-1">
                {ticket.createdBy?.name || 'Unknown User'}
              </strong>
              {ticket.createdBy?.role && (
                <span className="ml-1 text-[11px] text-slate-500">
                  ({ticket.createdBy.role})
                </span>
              )}
            </div>

            <div className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>Created: {createdDate}</span>
            </div>

            <div className="flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>Updated: {updatedDate}</span>
            </div>
          </div>
        </div>

        {/* Ticket Description (Immutable) */}
        <div className="p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Description
          </h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </div>
        </div>

        {/* Support Staff Actions Box (Support Only) */}
        {isSupport && (
          <div className="bg-slate-50/70 border-t border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-2 text-purple-900">
              <Shield className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Support Staff Controls
              </h2>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {statusError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Section A: Linear Status Progression */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Lifecycle Progression
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Strict forward-only state machine (Open &rarr; In Progress &rarr; Resolved &rarr; Closed)
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              {nextStatusConfig ? (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    Next Available Stage: <strong>{nextStatusConfig.next}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleStatusAdvance}
                    disabled={statusSubmitting}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 ${nextStatusConfig.btnClass}`}
                  >
                    {statusSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Advancing...
                      </>
                    ) : (
                      <>
                        <nextStatusConfig.Icon className="w-3.5 h-3.5 mr-1.5" />
                        {nextStatusConfig.label}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    <strong>Ticket Closed (Final State):</strong> Status cannot be modified or reopened.
                  </span>
                </div>
              )}
            </div>

            {/* Section B: Triage Controls (Category & Priority) */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Triage Management
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Adjust category and priority (permitted during Open &amp; In Progress only)
                  </p>
                </div>
                <Sliders className="w-4 h-4 text-slate-400" />
              </div>

              {/* Triage feedback messages */}
              {triageMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{triageMessage}</span>
                </div>
              )}
              {triageError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{triageError}</span>
                </div>
              )}

              {isTriageAllowed ? (
                <form onSubmit={handleTriageSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label htmlFor="triage-category" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      id="triage-category"
                      value={triageCategory}
                      onChange={(e) => setTriageCategory(e.target.value)}
                      disabled={triageSubmitting}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="triage-priority" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Priority
                    </label>
                    <select
                      id="triage-priority"
                      value={triagePriority}
                      onChange={(e) => setTriagePriority(e.target.value)}
                      disabled={triageSubmitting}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    >
                      {PRIORITIES.map((pri) => (
                        <option key={pri} value={pri}>
                          {pri}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={triageSubmitting}
                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center"
                  >
                    {triageSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Update Triage'
                    )}
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    <strong>Triage Locked:</strong> Category and priority cannot be modified when a ticket is in {ticket.status} status.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Append-Only Comments Form */}
      <CommentForm
        ticketId={ticket._id}
        isClosed={ticket.status === 'Closed'}
        onCommentAdded={fetchTimeline}
      />

      {/* Chronological Activity Timeline & Comments */}
      <ActivityTimeline timeline={timeline} loading={timelineLoading} />
    </div>
  );
}
