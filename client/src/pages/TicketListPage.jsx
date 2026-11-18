import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketApi } from '../api/client';
import TicketCard from '../components/TicketCard';
import TicketFilter from '../components/TicketFilter';
import { Plus, Ticket as TicketIcon, Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';

export default function TicketListPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (category) params.category = category;

      const response = await ticketApi.getTickets(params);
      if (response.data && response.data.success) {
        setTickets(response.data.data.tickets || []);
      } else {
        throw new Error('Failed to retrieve tickets');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to load tickets. Please verify your connection or try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, category]);

  // Debounce search/filter queries
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTickets();
    }, 200);

    return () => clearTimeout(timer);
  }, [fetchTickets]);

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setCategory('');
  };

  const isSupport = user?.role === 'Support';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {isSupport ? 'Global Support Queue' : 'My Support Tickets'}
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {tickets.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isSupport
              ? 'View, triage, and advance support tickets across all employees'
              : 'Track the status and progress of requests you have submitted'}
          </p>
        </div>

        <Link
          to="/tickets/new"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Ticket
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <TicketFilter
        search={search}
        status={status}
        category={category}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onCategoryChange={setCategory}
        onClear={handleClearFilters}
      />

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-medium">Loading tickets...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-red-800 mb-1">Error Loading Tickets</h3>
          <p className="text-xs text-red-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchTickets}
            className="inline-flex items-center px-3.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tickets.length === 0 && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Inbox className="w-6 h-6" />
          </div>
          {search || status || category ? (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                No Matching Tickets Found
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                No tickets matched your search query or selected filters.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Clear All Filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                No Tickets Found
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {isSupport
                  ? 'There are currently no tickets in the system queue.'
                  : 'You have not submitted any support tickets yet.'}
              </p>
              <Link
                to="/tickets/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create First Ticket
              </Link>
            </>
          )}
        </div>
      )}

      {/* Ticket List */}
      {!loading && !error && tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket._id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
