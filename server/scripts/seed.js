const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const TicketActivity = require('../models/TicketActivity');

/**
 * Validates the 3 mandatory safety guard layers before destructive operations.
 */
function validateSafetyGuards(env = process.env) {
  // Layer 1: Strictly reject production environment
  if (env.NODE_ENV === 'production') {
    throw new Error('CRITICAL ABORT: Database seeding is forbidden in production environments.');
  }

  // Layer 2: Require explicit confirmation flag
  if (env.ALLOW_SEED_RESET !== 'true') {
    throw new Error('CRITICAL ABORT: Seeding drops database collections. Set ALLOW_SEED_RESET=true to confirm.');
  }

  // Layer 3: Validate database target URI
  const dbUri = env.MONGODB_URI || '';
  const isLocalOrDevTest = dbUri.includes('localhost') ||
                           dbUri.includes('127.0.0.1') ||
                           dbUri.includes('_dev') ||
                           dbUri.includes('_test');
  if (!isLocalOrDevTest) {
    throw new Error('CRITICAL ABORT: Database target must be a local or explicit development/test database.');
  }
}

/**
 * Executes the database seed operation.
 */
async function seedDatabase(targetUri = process.env.MONGODB_URI) {
  // Validate safety guards
  validateSafetyGuards(process.env);

  const uri = targetUri || 'mongodb://localhost:27017/ticket_app_dev';
  console.log(`Connecting to database for seeding: ${uri}`);
  
  const conn = await mongoose.connect(uri);

  try {
    console.log('Resetting database collections...');
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await TicketActivity.deleteMany({});

    console.log('Creating sample user accounts with hashed passwords...');
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    const users = await User.create([
      {
        name: 'Alice Employee',
        email: 'alice@company.com',
        password: hashedPassword,
        role: 'Employee',
      },
      {
        name: 'Bob Employee',
        email: 'bob@company.com',
        password: hashedPassword,
        role: 'Employee',
      },
      {
        name: 'Charlie Support',
        email: 'charlie.support@company.com',
        password: hashedPassword,
        role: 'Support',
      },
      {
        name: 'Diana Support',
        email: 'diana.support@company.com',
        password: hashedPassword,
        role: 'Support',
      },
    ]);

    const [alice, bob, charlie, diana] = users;

    console.log('Creating 5 sample tickets...');
    const sampleTicketsData = [
      {
        title: 'Laptop not charging',
        description: 'Dell XPS power port is loose and fails to charge when plugged in.',
        category: 'Hardware',
        priority: 'High',
        status: 'Open',
        createdBy: alice._id,
      },
      {
        title: 'Cannot log in to VPN',
        description: 'Cisco AnyConnect returns handshake timeout after password entry.',
        category: 'Network',
        priority: 'High',
        status: 'In Progress',
        createdBy: alice._id,
      },
      {
        title: 'Need access to the shared project folder',
        description: 'Need read/write access to the Q4 Financials network drive.',
        category: 'Access',
        priority: 'Medium',
        status: 'Open',
        createdBy: bob._id,
      },
      {
        title: 'Excel keeps crashing on startup',
        description: 'Microsoft Excel 365 crashes immediately with error code 0xC0000005.',
        category: 'Software',
        priority: 'Medium',
        status: 'Resolved',
        createdBy: bob._id,
      },
      {
        title: 'Request a second monitor',
        description: 'Requesting an auxiliary 27-inch monitor for development workspace.',
        category: 'Hardware',
        priority: 'Low',
        status: 'Closed',
        createdBy: alice._id,
      },
    ];

    const createdTickets = await Ticket.create(sampleTicketsData);

    console.log('Creating initial activity history for tickets...');
    // Activity for Ticket 1: Open
    await TicketActivity.create({
      ticketId: createdTickets[0]._id,
      performedBy: alice._id,
      activityType: 'CREATED',
      details: { message: 'Ticket created with status Open' },
    });

    // Activity for Ticket 2: In Progress
    await TicketActivity.create([
      {
        ticketId: createdTickets[1]._id,
        performedBy: alice._id,
        activityType: 'CREATED',
        details: { message: 'Ticket created with status Open' },
      },
      {
        ticketId: createdTickets[1]._id,
        performedBy: charlie._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'Open',
          newValue: 'In Progress',
          message: 'Status updated from Open to In Progress',
        },
      },
    ]);

    // Activity for Ticket 3: Open
    await TicketActivity.create({
      ticketId: createdTickets[2]._id,
      performedBy: bob._id,
      activityType: 'CREATED',
      details: { message: 'Ticket created with status Open' },
    });

    // Activity for Ticket 4: Resolved
    await TicketActivity.create([
      {
        ticketId: createdTickets[3]._id,
        performedBy: bob._id,
        activityType: 'CREATED',
        details: { message: 'Ticket created with status Open' },
      },
      {
        ticketId: createdTickets[3]._id,
        performedBy: charlie._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'Open',
          newValue: 'In Progress',
          message: 'Status updated from Open to In Progress',
        },
      },
      {
        ticketId: createdTickets[3]._id,
        performedBy: charlie._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'In Progress',
          newValue: 'Resolved',
          message: 'Status updated from In Progress to Resolved',
        },
      },
    ]);

    // Activity for Ticket 5: Closed
    await TicketActivity.create([
      {
        ticketId: createdTickets[4]._id,
        performedBy: alice._id,
        activityType: 'CREATED',
        details: { message: 'Ticket created with status Open' },
      },
      {
        ticketId: createdTickets[4]._id,
        performedBy: diana._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'Open',
          newValue: 'In Progress',
          message: 'Status updated from Open to In Progress',
        },
      },
      {
        ticketId: createdTickets[4]._id,
        performedBy: diana._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'In Progress',
          newValue: 'Resolved',
          message: 'Status updated from In Progress to Resolved',
        },
      },
      {
        ticketId: createdTickets[4]._id,
        performedBy: diana._id,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'Resolved',
          newValue: 'Closed',
          message: 'Status updated from Resolved to Closed',
        },
      },
    ]);

    console.log('Seeding completed successfully:');
    console.log(`- ${users.length} Users seeded (2 Employees, 2 Support)`);
    console.log(`- ${createdTickets.length} Tickets seeded`);

    return { users, tickets: createdTickets };
  } finally {
    // Only close connection if this script created its own standalone connection
    if (require.main === module) {
      await mongoose.disconnect();
    }
  }
}

// Run immediately if invoked as CLI script
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Database seeding process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { seedDatabase, validateSafetyGuards };
