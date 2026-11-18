const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');
const { checkStatusTransition } = require('../utils/stateMachine');

const VALID_CATEGORIES = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

/**
 * @desc    Create a new support ticket
 * @route   POST /api/tickets
 * @access  Private (Employee & Support)
 */
const createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot exceed 100 characters',
      });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot be empty',
      });
    }

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed values: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // Validate priority
    const ticketPriority = priority || 'Medium';
    if (!VALID_PRIORITIES.includes(ticketPriority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`,
      });
    }

    // Create ticket document
    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority: ticketPriority,
      status: 'Open',
      createdBy: req.user.id,
    });

    // Populate createdBy details
    await ticket.populate('createdBy', 'name email role');

    // Record CREATED activity event
    await TicketActivity.create({
      ticketId: ticket._id,
      performedBy: req.user.id,
      activityType: 'CREATED',
      details: {
        message: 'Ticket created with status Open',
      },
    });

    return res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List tickets (Employees see own tickets; Support Staff see all)
 * @route   GET /api/tickets
 * @access  Private (Employee & Support)
 */
const getTickets = async (req, res, next) => {
  try {
    const { search, status, category } = req.query;

    const query = {};

    // Ownership scoping: Employees are strictly locked to their own tickets
    if (req.user.role === 'Employee') {
      query.createdBy = req.user.id;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Search filter by title
    if (search && typeof search === 'string' && search.trim().length > 0) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const tickets = await Ticket.find(query)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        total: tickets.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ticket details by ID
 * @route   GET /api/tickets/:id
 * @access  Private (Owner Employee or Support Staff)
 */
const getTicketById = async (req, res) => {
  // Ticket document is already retrieved and access-validated by canAccessTicket middleware
  return res.status(200).json({
    success: true,
    data: req.ticket,
  });
};

/**
 * @desc    Update ticket status following strict forward-only progression
 * @route   PATCH /api/tickets/:id/status
 * @access  Private (Support Staff only)
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ticket = req.ticket;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Target status is required',
      });
    }

    // Validate state transition using strict finite state machine
    const transitionCheck = checkStatusTransition(ticket.status, status);
    if (!transitionCheck.valid) {
      return res.status(transitionCheck.code).json({
        success: false,
        message: transitionCheck.message,
      });
    }

    const previousStatus = ticket.status;
    ticket.status = status;
    await ticket.save(); // Refreshes updatedAt timestamp

    // Record STATUS_CHANGED activity event
    await TicketActivity.create({
      ticketId: ticket._id,
      performedBy: req.user.id,
      activityType: 'STATUS_CHANGED',
      details: {
        previousValue: previousStatus,
        newValue: status,
        message: `Status updated from ${previousStatus} to ${status}`,
      },
    });

    return res.status(200).json({
      success: true,
      data: ticket,
      message: `Ticket status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Triage ticket category and priority (Only in Open or In Progress)
 * @route   PATCH /api/tickets/:id/triage
 * @access  Private (Support Staff only)
 */
const triageTicket = async (req, res, next) => {
  try {
    const { category, priority } = req.body;
    const ticket = req.ticket;

    // Business Rule (FR-TCK-06 / FR-TCK-07): Triage forbidden on Resolved and Closed tickets
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      return res.status(409).json({
        success: false,
        message: `Cannot triage ticket: tickets in Resolved or Closed status cannot be modified (current status: "${ticket.status}").`,
      });
    }

    if (!category && !priority) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (category or priority) must be provided for triage.',
      });
    }

    const changes = [];
    const previousValues = {};
    const newValues = {};

    // Validate & apply category update
    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Allowed values: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      if (category !== ticket.category) {
        previousValues.category = ticket.category;
        newValues.category = category;
        changes.push(`category from "${ticket.category}" to "${category}"`);
        ticket.category = category;
      }
    }

    // Validate & apply priority update
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`,
        });
      }
      if (priority !== ticket.priority) {
        previousValues.priority = ticket.priority;
        newValues.priority = priority;
        changes.push(`priority from "${ticket.priority}" to "${priority}"`);
        ticket.priority = priority;
      }
    }

    // If values are identical to current, simply return ticket
    if (changes.length > 0) {
      await ticket.save(); // Refreshes updatedAt timestamp

      // Record TRIAGED activity event
      await TicketActivity.create({
        ticketId: ticket._id,
        performedBy: req.user.id,
        activityType: 'TRIAGED',
        details: {
          previousValue: JSON.stringify(previousValues),
          newValue: JSON.stringify(newValues),
          message: `Triage updated: ${changes.join(', ')}`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
      message: 'Ticket triage updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  triageTicket,
};
