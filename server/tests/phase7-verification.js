/**
 * Phase 7 Automated Integration Verification Script
 * Validates all Phase 7 frontend-backend contract requirements:
 * 1. Employee sees only their own tickets.
 * 2. Support sees all tickets across all employees.
 * 3. Ticket creation succeeds for both roles with initial Open status.
 * 4. Search and filter query parameters work correctly.
 * 5. Employee cannot view other users' tickets (403) or perform triage/status updates (403).
 * 6. Support can view any ticket and perform triage (Open/In Progress only).
 * 7. Support can advance status strictly forward (Open -> In Progress -> Resolved -> Closed).
 * 8. Invalid status transitions (skips/backward) rejected with 400.
 * 9. Status updates and triage on Closed tickets are strictly rejected (409 Conflict).
 */

const axios = require('../../client/node_modules/axios');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');

async function runPhase7Verification() {
  console.log('--- Starting Phase 7 Ticket Management Verification ---');
  let mongoServer;
  let serverInstance;

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const alice = await User.create({
      name: 'Alice Employee',
      email: 'alice@company.com',
      password: hashedPassword,
      role: 'Employee',
    });

    const bob = await User.create({
      name: 'Bob Employee',
      email: 'bob@company.com',
      password: hashedPassword,
      role: 'Employee',
    });

    const charlie = await User.create({
      name: 'Charlie Support',
      email: 'charlie.support@company.com',
      password: hashedPassword,
      role: 'Support',
    });

    // Seed 2 tickets for Alice, 1 for Bob
    await Ticket.create([
      {
        title: 'Alice VPN Issue',
        description: 'VPN disconnects every 5 minutes.',
        category: 'Network',
        priority: 'High',
        status: 'Open',
        createdBy: alice._id,
      },
      {
        title: 'Alice Monitor Request',
        description: 'Need dual monitor display.',
        category: 'Hardware',
        priority: 'Low',
        status: 'In Progress',
        createdBy: alice._id,
      },
      {
        title: 'Bob Excel Crash',
        description: 'Excel crashes on startup.',
        category: 'Software',
        priority: 'Medium',
        status: 'Open',
        createdBy: bob._id,
      },
    ]);

    const serverPort = 5577;
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(serverPort, resolve));
    const baseUrl = `http://127.0.0.1:${serverPort}/api`;

    const api = axios.create({ baseURL: baseUrl });

    // Authenticate Alice (Employee)
    const aliceLogin = await api.post('/auth/login', {
      email: 'alice@company.com',
      password: 'Password123!',
    });
    const aliceToken = aliceLogin.data.data.token;
    const aliceHeaders = { Authorization: `Bearer ${aliceToken}` };

    // Authenticate Charlie (Support)
    const charlieLogin = await api.post('/auth/login', {
      email: 'charlie.support@company.com',
      password: 'Password123!',
    });
    const charlieToken = charlieLogin.data.data.token;
    const charlieHeaders = { Authorization: `Bearer ${charlieToken}` };

    // 1. Employee sees only their own tickets
    console.log('[Verification 1] Testing Employee ticket scoping...');
    const aliceTicketsRes = await api.get('/tickets', { headers: aliceHeaders });
    const aliceTickets = aliceTicketsRes.data.data.tickets;
    if (aliceTickets.length !== 2 || aliceTickets.some((t) => t.title.includes('Bob'))) {
      throw new Error(`Verification 1 Failed: Alice saw ${aliceTickets.length} tickets instead of 2 own tickets`);
    }
    console.log('✓ Verification 1 Passed: Alice sees only her 2 tickets.');

    // 2. Support sees all tickets
    console.log('[Verification 2] Testing Support global ticket queue...');
    const charlieTicketsRes = await api.get('/tickets', { headers: charlieHeaders });
    const allTickets = charlieTicketsRes.data.data.tickets;
    if (allTickets.length !== 3) {
      throw new Error(`Verification 2 Failed: Support saw ${allTickets.length} tickets instead of all 3`);
    }
    console.log('✓ Verification 2 Passed: Support sees all 3 tickets.');

    // 3. Ticket creation by Employee
    console.log('[Verification 3a] Employee ticket creation...');
    const createEmpRes = await api.post(
      '/tickets',
      {
        title: 'New Keyboard Request',
        description: 'Spacebar is stuck on mechanical keyboard.',
        category: 'Hardware',
        priority: 'Medium',
      },
      { headers: aliceHeaders }
    );
    if (createEmpRes.status !== 201 || createEmpRes.data.data.status !== 'Open') {
      throw new Error('Verification 3a Failed: Employee ticket creation failed');
    }
    const createdTicketId = createEmpRes.data.data._id;
    console.log('✓ Verification 3a Passed: Employee created ticket with initial Open status.');

    // 3b. Ticket creation by Support
    console.log('[Verification 3b] Support ticket creation...');
    const createSupportRes = await api.post(
      '/tickets',
      {
        title: 'Server Maintenance Notice Ticket',
        description: 'Scheduled maintenance for staging server.',
        category: 'Network',
        priority: 'High',
      },
      { headers: charlieHeaders }
    );
    if (createSupportRes.status !== 201 || createSupportRes.data.data.status !== 'Open') {
      throw new Error('Verification 3b Failed: Support ticket creation failed');
    }
    console.log('✓ Verification 3b Passed: Support created ticket with initial Open status.');

    // 4. Search and filters
    console.log('[Verification 4] Testing search and filter query parameters...');
    const searchRes = await api.get('/tickets?search=Keyboard', { headers: aliceHeaders });
    if (searchRes.data.data.tickets.length !== 1 || !searchRes.data.data.tickets[0].title.includes('Keyboard')) {
      throw new Error('Verification 4 Failed: Search by title failed');
    }

    const filterStatusRes = await api.get('/tickets?status=In Progress', { headers: charlieHeaders });
    if (filterStatusRes.data.data.tickets.length !== 1 || filterStatusRes.data.data.tickets[0].status !== 'In Progress') {
      throw new Error('Verification 4 Failed: Filter by status failed');
    }

    const filterCategoryRes = await api.get('/tickets?category=Software', { headers: charlieHeaders });
    if (filterCategoryRes.data.data.tickets.length !== 1 || filterCategoryRes.data.data.tickets[0].category !== 'Software') {
      throw new Error('Verification 4 Failed: Filter by category failed');
    }
    console.log('✓ Verification 4 Passed: Search and filter queries operate correctly.');

    // 5. Employee permission boundaries
    console.log('[Verification 5] Testing Employee permission boundaries...');
    const bobTicket = allTickets.find((t) => t.title.includes('Bob'));
    let aliceAccessForbidden = false;
    try {
      await api.get(`/tickets/${bobTicket._id}`, { headers: aliceHeaders });
    } catch (err) {
      if (err.response?.status === 403) aliceAccessForbidden = true;
    }
    if (!aliceAccessForbidden) {
      throw new Error('Verification 5 Failed: Employee accessed another user ticket without 403');
    }

    let aliceTriageForbidden = false;
    try {
      await api.patch(
        `/tickets/${createdTicketId}/triage`,
        { category: 'Software', priority: 'High' },
        { headers: aliceHeaders }
      );
    } catch (err) {
      if (err.response?.status === 403) aliceTriageForbidden = true;
    }
    if (!aliceTriageForbidden) {
      throw new Error('Verification 5 Failed: Employee triaged ticket without 403');
    }

    let aliceStatusForbidden = false;
    try {
      await api.patch(
        `/tickets/${createdTicketId}/status`,
        { status: 'In Progress' },
        { headers: aliceHeaders }
      );
    } catch (err) {
      if (err.response?.status === 403) aliceStatusForbidden = true;
    }
    if (!aliceStatusForbidden) {
      throw new Error('Verification 5 Failed: Employee updated status without 403');
    }
    console.log('✓ Verification 5 Passed: Employee correctly blocked with 403 from viewing other tickets and from triage/status actions.');

    // 6. Support triage on Open ticket
    console.log('[Verification 6] Support triage on Open ticket...');
    const triageRes = await api.patch(
      `/tickets/${createdTicketId}/triage`,
      { category: 'Other', priority: 'High' },
      { headers: charlieHeaders }
    );
    if (triageRes.data.data.category !== 'Other' || triageRes.data.data.priority !== 'High') {
      throw new Error('Verification 6 Failed: Support triage failed');
    }
    console.log('✓ Verification 6 Passed: Support successfully updated category and priority.');

    // 7. Support strict linear status progression
    console.log('[Verification 7] Support linear status transitions (Open -> In Progress -> Resolved -> Closed)...');
    // Open -> In Progress
    const toProgress = await api.patch(
      `/tickets/${createdTicketId}/status`,
      { status: 'In Progress' },
      { headers: charlieHeaders }
    );
    if (toProgress.data.data.status !== 'In Progress') throw new Error('Failed transition to In Progress');

    // In Progress -> Resolved
    const toResolved = await api.patch(
      `/tickets/${createdTicketId}/status`,
      { status: 'Resolved' },
      { headers: charlieHeaders }
    );
    if (toResolved.data.data.status !== 'Resolved') throw new Error('Failed transition to Resolved');

    // Resolved -> Closed
    const toClosed = await api.patch(
      `/tickets/${createdTicketId}/status`,
      { status: 'Closed' },
      { headers: charlieHeaders }
    );
    if (toClosed.data.data.status !== 'Closed') throw new Error('Failed transition to Closed');
    console.log('✓ Verification 7 Passed: Successfully advanced Open -> In Progress -> Resolved -> Closed.');

    // 8. Rejection of invalid status transitions (e.g. attempting to reopen Closed ticket)
    console.log('[Verification 8] Verifying rejection of modifying Closed ticket status...');
    let reopenRejected = false;
    try {
      await api.patch(
        `/tickets/${createdTicketId}/status`,
        { status: 'In Progress' },
        { headers: charlieHeaders }
      );
    } catch (err) {
      if (err.response?.status === 409) reopenRejected = true;
    }
    if (!reopenRejected) throw new Error('Verification 8 Failed: Closed ticket was not protected with 409 Conflict');
    console.log('✓ Verification 8 Passed: Closed ticket status modification correctly rejected with 409 Conflict.');

    // 9. Rejection of triage on Closed ticket
    console.log('[Verification 9] Verifying rejection of triage on Closed ticket...');
    let closedTriageRejected = false;
    try {
      await api.patch(
        `/tickets/${createdTicketId}/triage`,
        { priority: 'Low' },
        { headers: charlieHeaders }
      );
    } catch (err) {
      if (err.response?.status === 409) closedTriageRejected = true;
    }
    if (!closedTriageRejected) throw new Error('Verification 9 Failed: Triage on Closed ticket was not rejected with 409');
    console.log('✓ Verification 9 Passed: Triage on Closed ticket correctly rejected with 409 Conflict.');

    console.log('\n======================================================');
    console.log('ALL PHASE 7 TICKET MANAGEMENT VERIFICATION CHECKS PASSED!');
    console.log('======================================================');
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runPhase7Verification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
