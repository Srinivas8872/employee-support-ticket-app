const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const TicketActivity = require('../models/TicketActivity');

/**
 * @desc    Add a new comment to a ticket (append-only)
 * @route   POST /api/tickets/:id/comments
 * @access  Private (Ticket Creator Employee or any Support Staff; allowed on any status including Closed)
 */
const createComment = async (req, res, next) => {
  const { content } = req.body;

  // Validate comment content
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment content cannot be empty',
    });
  }

  if (content.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Comment cannot exceed 1000 characters',
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Create comment document within transaction
    const [newComment] = await Comment.create(
      [
        {
          ticketId: req.ticket._id,
          author: req.user.id,
          content: content.trim(),
        },
      ],
      { session }
    );

    // 2. Create corresponding COMMENTED TicketActivity event within transaction
    await TicketActivity.create(
      [
        {
          ticketId: req.ticket._id,
          performedBy: req.user.id,
          activityType: 'COMMENTED',
          details: {
            message: 'Comment added',
          },
        },
      ],
      { session }
    );

    // 3. Commit transaction atomically
    await session.commitTransaction();
    session.endSession();

    // Populate author details for response
    await newComment.populate('author', 'name email role');

    return res.status(201).json({
      success: true,
      data: newComment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (abortErr) {
        // Suppress secondary abort errors
      }
      session.endSession();
    }

    // Fallback for standalone non-replica-set environments (e.g. dev)
    if (
      error.message &&
      (error.message.includes('replica set') ||
        error.message.includes('Transaction numbers are only allowed on a replica set member'))
    ) {
      try {
        const comment = await Comment.create({
          ticketId: req.ticket._id,
          author: req.user.id,
          content: content.trim(),
        });

        await TicketActivity.create({
          ticketId: req.ticket._id,
          performedBy: req.user.id,
          activityType: 'COMMENTED',
          details: {
            message: 'Comment added',
          },
        });

        await comment.populate('author', 'name email role');

        return res.status(201).json({
          success: true,
          data: comment,
          message: 'Comment added successfully',
        });
      } catch (fallbackError) {
        return next(fallbackError);
      }
    }

    next(error);
  }
};

/**
 * @desc    Retrieve unified chronological timeline (activities and comments combined)
 * @route   GET /api/tickets/:id/timeline
 * @access  Private (Ticket Creator Employee or any Support Staff)
 */
const getTicketTimeline = async (req, res, next) => {
  try {
    // 1. Fetch non-comment audit activities (CREATED, STATUS_CHANGED, TRIAGED)
    const activities = await TicketActivity.find({
      ticketId: req.ticket._id,
      activityType: { $ne: 'COMMENTED' },
    })
      .populate('performedBy', 'name email role')
      .lean();

    // 2. Fetch comments
    const comments = await Comment.find({ ticketId: req.ticket._id })
      .populate('author', 'name email role')
      .lean();

    // 3. Normalize activities for timeline
    const formattedActivities = activities.map((act) => ({
      _id: act._id,
      type: 'ACTIVITY',
      activityType: act.activityType,
      ticketId: act.ticketId,
      performedBy: act.performedBy,
      details: act.details,
      createdAt: act.createdAt,
    }));

    // 4. Normalize comments for timeline
    const formattedComments = comments.map((comment) => ({
      _id: comment._id,
      type: 'COMMENT',
      activityType: 'COMMENTED',
      ticketId: comment.ticketId,
      author: comment.author,
      performedBy: comment.author,
      content: comment.content,
      details: {
        message: comment.content,
      },
      createdAt: comment.createdAt,
    }));

    // 5. Combine and sort chronologically ascending with deterministic secondary rule
    const timeline = [...formattedActivities, ...formattedComments].sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Secondary deterministic rule: CREATED events precede transitions/comments; otherwise sort by ObjectId
      if (a.activityType === 'CREATED') return -1;
      if (b.activityType === 'CREATED') return 1;
      return String(a._id).localeCompare(String(b._id));
    });

    return res.status(200).json({
      success: true,
      data: timeline,
      total: timeline.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComment,
  getTicketTimeline,
};
