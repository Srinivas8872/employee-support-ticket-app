import React, { useState } from 'react';
import { ticketApi } from '../api/client';
import { Send, Loader2, AlertCircle, CheckCircle2, MessageSquare, Info } from 'lucide-react';

export default function CommentForm({ ticketId, isClosed, onCommentAdded }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const remainingChars = 1000 - content.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setApiError('');
    setSuccessMessage('');

    const trimmed = content.trim();
    if (!trimmed) {
      setValidationError('Comment content cannot be empty.');
      return;
    }

    if (trimmed.length > 1000) {
      setValidationError('Comment cannot exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ticketApi.addComment(ticketId, trimmed);
      if (response.data && response.data.success) {
        setContent('');
        setSuccessMessage('Comment added successfully.');
        if (onCommentAdded) {
          onCommentAdded(response.data.data);
        }
        // Auto-clear success message after 4s
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        throw new Error('Failed to post comment');
      }
    } catch (err) {
      setApiError(
        err.response?.data?.message ||
        'Unable to post comment. Please check your connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-slate-800">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Add a Comment
          </h3>
        </div>
        {isClosed && (
          <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            Comments allowed on Closed tickets
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Comments are append-only audit records and cannot be edited or deleted once submitted.
      </p>

      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {(validationError || apiError) && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{validationError || apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <textarea
            id="comment-content"
            aria-label="Comment content"
            rows={4}
            value={content}
            maxLength={1000}
            onChange={(e) => {
              setContent(e.target.value);
              setValidationError('');
              setApiError('');
            }}
            placeholder="Type your comment or update here..."
            disabled={isSubmitting}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-y"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <span
            className={`text-[11px] font-mono ${
              remainingChars < 50 ? 'text-red-500 font-bold' : 'text-slate-400'
            }`}
          >
            {remainingChars} characters remaining
          </span>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Post Comment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
