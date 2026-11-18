const mongoose = require('mongoose');

const ticketActivitySchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'Ticket ID is required'],
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performer is required'],
    },
    activityType: {
      type: String,
      enum: {
        values: ['CREATED', 'STATUS_CHANGED', 'TRIAGED', 'COMMENTED'],
        message: '{VALUE} is not a valid activity type',
      },
      required: [true, 'Activity type is required'],
    },
    details: {
      previousValue: { type: String },
      newValue: { type: String },
      message: { type: String, required: [true, 'Activity message is required'] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TicketActivity = mongoose.model('TicketActivity', ticketActivitySchema);

module.exports = TicketActivity;
