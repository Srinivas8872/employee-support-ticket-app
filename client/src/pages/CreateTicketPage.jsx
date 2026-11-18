import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ticketApi } from '../api/client';
import { ArrowLeft, Loader2, AlertCircle, PlusCircle } from 'lucide-react';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export default function CreateTicketPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software');
  const [priority, setPriority] = useState('Medium');

  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleRemaining = 100 - title.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setApiError('');

    // Client-side validations
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError('Please enter a ticket title.');
      return;
    }

    if (trimmedTitle.length > 100) {
      setValidationError('Title cannot exceed 100 characters.');
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setValidationError('Please enter a detailed description of the issue.');
      return;
    }

    if (!CATEGORIES.includes(category)) {
      setValidationError('Please select a valid category.');
      return;
    }

    if (!PRIORITIES.includes(priority)) {
      setValidationError('Please select a valid priority level.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ticketApi.createTicket({
        title: trimmedTitle,
        description: trimmedDescription,
        category,
        priority,
      });

      if (response.data && response.data.success) {
        const createdId = response.data.data._id;
        navigate(`/tickets/${createdId}`);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err) {
      setApiError(
        err.response?.data?.message ||
        'Unable to create ticket. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Return Link */}
      <Link
        to="/tickets"
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
        Back to Tickets
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create New Support Ticket</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit an IT support request. Tickets begin with status <strong>Open</strong>.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5" noValidate>
          {/* Error Banner */}
          {(validationError || apiError) && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-700"
            >
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>{validationError || apiError}</span>
            </div>
          )}

          {/* Title Field */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="title" className="text-xs font-semibold text-slate-700">
                Ticket Title <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  titleRemaining < 10 ? 'text-red-500 font-bold' : 'text-slate-400'
                }`}
              >
                {titleRemaining} chars remaining
              </span>
            </div>
            <input
              id="title"
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => {
                setTitle(e.target.value);
                setValidationError('');
                setApiError('');
              }}
              placeholder="e.g. Cannot connect to office VPN"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Priority <span className="text-red-500">*</span>
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                {PRIORITIES.map((pri) => (
                  <option key={pri} value={pri}>
                    {pri}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-xs font-semibold text-slate-700 mb-1">
              Issue Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setValidationError('');
                setApiError('');
              }}
              placeholder="Provide relevant details, steps to reproduce, or error messages..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <Link
              to="/tickets"
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
