const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');

/**
 * Middleware ensuring requesting user is authorized to access the specified ticket.
 * - Support Staff has access to all tickets.
 * - Employees have access only to tickets they created.
 */
const canAccessTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    const ticket = await Ticket.findById(id).populate('createdBy', 'name email role');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
      });
    }

    // Support Staff can access any ticket
    if (req.user.role === 'Support') {
      req.ticket = ticket;
      return next();
    }

    // Employee must match ticket creator
    const creatorId = ticket.createdBy._id
      ? ticket.createdBy._id.toString()
      : ticket.createdBy.toString();

    if (creatorId === req.user.id) {
      req.ticket = ticket;
      return next();
    }

    // Forbidden for other employees
    return res.status(403).json({
      success: false,
      message: 'Access denied: you do not have permission to view or manage this ticket.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { canAccessTicket };
