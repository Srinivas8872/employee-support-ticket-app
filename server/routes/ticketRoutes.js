const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  triageTicket,
} = require('../controllers/ticketController');
const {
  createComment,
  getTicketTimeline,
} = require('../controllers/commentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { canAccessTicket } = require('../middleware/ticketAccessMiddleware');

// All ticket routes require authentication
router.use(requireAuth);

// Create ticket (Employee & Support)
router.post('/', createTicket);

// List tickets (Role-scoped: Employee sees own; Support sees all)
router.get('/', getTickets);

// Get single ticket details
router.get('/:id', canAccessTicket, getTicketById);

// Update ticket status (Support Staff only, forward-only progression)
router.patch('/:id/status', requireRole(['Support']), canAccessTicket, updateTicketStatus);

// Triage ticket category & priority (Support Staff only, Open & In Progress only)
router.patch('/:id/triage', requireRole(['Support']), canAccessTicket, triageTicket);

// Add comment to ticket (Employee on own ticket, Support Staff on any ticket; allowed on any status including Closed)
router.post('/:id/comments', canAccessTicket, createComment);

// Retrieve unified chronological activity and comment timeline
router.get('/:id/timeline', canAccessTicket, getTicketTimeline);

module.exports = router;
