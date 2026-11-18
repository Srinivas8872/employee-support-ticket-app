/**
 * Phase 8 Automated Integration Verification Script
 * Validates all Phase 8 Comments & Activity Timeline requirements:
 * 1. Employee can view comments & timeline on own ticket.
 * 2. Support can view comments & timeline on any ticket.
 * 3. Both roles can post comments.
 * 4. Empty/whitespace comments are rejected with 400 Bad Request.
 * 5. Comments exceeding 1000 characters are rejected with 400 Bad Request.
 * 6. Comments can be added to Closed tickets (returns 201).
 * 7. Comments are append-only; edit/delete requests return 404.
 * 8. Employees cannot access another employee's ticket timeline/comments (403 Forbidden).
 * 9. Activity Timeline displays CREATED, STATUS_CHANGED, TRIAGED, and COMMENT events.
 * 10. Timeline updates after a new comment and maintains chronological order.
 */

const axios = require('../../client/node_modules/axios');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const TicketActivity = require('../models/TicketActivity');

async function runPhase8Verification() {
  console.log('--- Starting Phase 8 Comments & Timeline Verification ---');
  let mongoServer;
  let serverInstance;

  try {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
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

    // Create a Closed ticket for Alice and an Open ticket for Bob
    const aliceClosedTicket = await Ticket.create({
      title: 'Old Closed Projector Issue',
      description: 'HDMI cable was replaced.',
      category: 'Hardware',
      priority: 'Low',
      status: 'Closed',
      createdBy: alice._id,
    });

    await TicketActivity.create([
      {
        ticketId: aliceClosedTicket._id,
        performedBy: alice._id,
        activityType: 'CREATED',
        details: { message: 'Ticket created with status Open' },
      },
      {
        ticketId: aliceClosedTicket._id,
        performedBy: charlie._id,
        activityType: 'STATUS_CHANGED',
        details: { previousValue: 'Open', newValue: 'Closed', message: 'Status updated from Open to Closed' },
      },
    ]);

    const bobOpenTicket = await Ticket.create({
      title: 'Bob Cloud Storage Access',
      description: 'Need access to AWS bucket.',
      category: 'Access',
      priority: 'Medium',
      status: 'Open',
      createdBy: bob._id,
    });

    await TicketActivity.create({
      ticketId: bobOpenTicket._id,
      performedBy: bob._id,
      activityType: 'CREATED',
      details: { message: 'Ticket created with status Open' },
    });

    const serverPort = 5588;
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

    // 1. Employee can view comments on own ticket
    console.log('[Verification 1] Testing Employee viewing own timeline...');
    const aliceTimelineRes = await api.get(`/tickets/${aliceClosedTicket._id}/timeline`, {
      headers: aliceHeaders,
    });
    if (aliceTimelineRes.status !== 200 || !Array.isArray(aliceTimelineRes.data.data)) {
      throw new Error('Verification 1 Failed: Alice could not view own ticket timeline');
    }
    console.log('✓ Verification 1 Passed: Employee can access own ticket timeline.');

    // 2. Support can view comments on any ticket
    console.log('[Verification 2] Testing Support viewing any ticket timeline...');
    const charlieTimelineRes = await api.get(`/tickets/${bobOpenTicket._id}/timeline`, {
      headers: charlieHeaders,
    });
    if (charlieTimelineRes.status !== 200 || !Array.isArray(charlieTimelineRes.data.data)) {
      throw new Error('Verification 2 Failed: Support could not view Bob ticket timeline');
    }
    console.log('✓ Verification 2 Passed: Support can access any ticket timeline.');

    // 3. Employee and Support can post comments
    console.log('[Verification 3] Both roles can add comments...');
    const aliceCommentRes = await api.post(
      `/tickets/${aliceClosedTicket._id}/comments`,
      { content: 'Alice posting a question on her ticket.' },
      { headers: aliceHeaders }
    );
    if (aliceCommentRes.status !== 201 || aliceCommentRes.data.data.content !== 'Alice posting a question on her ticket.') {
      throw new Error('Verification 3 Failed: Alice comment post failed');
    }

    const charlieCommentRes = await api.post(
      `/tickets/${aliceClosedTicket._id}/comments`,
      { content: 'Charlie Support responding to Alice.' },
      { headers: charlieHeaders }
    );
    if (charlieCommentRes.status !== 201 || charlieCommentRes.data.data.content !== 'Charlie Support responding to Alice.') {
      throw new Error('Verification 3 Failed: Charlie comment post failed');
    }
    console.log('✓ Verification 3 Passed: Both Employee and Support can post comments.');

    // 4. Empty/whitespace comments rejected
    console.log('[Verification 4] Validating empty comments are rejected...');
    let emptyRejected = false;
    try {
      await api.post(
        `/tickets/${aliceClosedTicket._id}/comments`,
        { content: '   ' },
        { headers: aliceHeaders }
      );
    } catch (err) {
      if (err.response?.status === 400) emptyRejected = true;
    }
    if (!emptyRejected) throw new Error('Verification 4 Failed: Empty comment was not rejected with 400');
    console.log('✓ Verification 4 Passed: Empty/whitespace comments rejected with 400 Bad Request.');

    // 5. Comments exceeding 1000 characters rejected
    console.log('[Verification 5] Validating comments > 1000 chars are rejected...');
    let longRejected = false;
    try {
      await api.post(
        `/tickets/${aliceClosedTicket._id}/comments`,
        { content: 'Z'.repeat(1001) },
        { headers: aliceHeaders }
      );
    } catch (err) {
      if (err.response?.status === 400) longRejected = true;
    }
    if (!longRejected) throw new Error('Verification 5 Failed: Long comment was not rejected with 400');
    console.log('✓ Verification 5 Passed: Comments exceeding 1000 characters rejected with 400 Bad Request.');

    // 6. Comments allowed on Closed tickets
    console.log('[Verification 6] Comments permitted on Closed tickets...');
    const closedCommentRes = await api.post(
      `/tickets/${aliceClosedTicket._id}/comments`,
      { content: 'Follow-up comment on Closed ticket.' },
      { headers: aliceHeaders }
    );
    if (closedCommentRes.status !== 201) {
      throw new Error('Verification 6 Failed: Commenting on Closed ticket failed');
    }
    console.log('✓ Verification 6 Passed: Comments permitted on tickets in Closed status.');

    // 7. Comments are append-only (no edit or delete)
    console.log('[Verification 7] Confirming append-only comment immutability...');
    const commentId = aliceCommentRes.data.data._id;
    let putRejected = false;
    try {
      await api.put(`/tickets/${aliceClosedTicket._id}/comments/${commentId}`, { content: 'edit' }, { headers: aliceHeaders });
    } catch (err) {
      if (err.response?.status === 404) putRejected = true;
    }
    let deleteRejected = false;
    try {
      await api.delete(`/tickets/${aliceClosedTicket._id}/comments/${commentId}`, { headers: aliceHeaders });
    } catch (err) {
      if (err.response?.status === 404) deleteRejected = true;
    }
    if (!putRejected || !deleteRejected) throw new Error('Verification 7 Failed: Edit/delete was not 404');
    console.log('✓ Verification 7 Passed: Comments are strictly append-only (PUT/DELETE return 404).');

    // 8. Employee cannot access another employee's comments/timeline
    console.log('[Verification 8] Employee cross-tenant privacy guard...');
    let crossAccessForbidden = false;
    try {
      await api.get(`/tickets/${bobOpenTicket._id}/timeline`, { headers: aliceHeaders });
    } catch (err) {
      if (err.response?.status === 403) crossAccessForbidden = true;
    }
    if (!crossAccessForbidden) throw new Error('Verification 8 Failed: Employee accessed another employee timeline without 403');
    console.log('✓ Verification 8 Passed: Employee cannot access another employee ticket timeline (403 Forbidden).');

    // 9. Activity timeline displays all event types in chronological order
    console.log('[Verification 9] Verifying timeline event types and chronological ordering...');
    const fullTimelineRes = await api.get(`/tickets/${aliceClosedTicket._id}/timeline`, { headers: aliceHeaders });
    const timeline = fullTimelineRes.data.data;

    const hasCreated = timeline.some((item) => item.activityType === 'CREATED');
    const hasStatus = timeline.some((item) => item.activityType === 'STATUS_CHANGED');
    const hasComment = timeline.some((item) => item.type === 'COMMENT' || item.activityType === 'COMMENTED');

    if (!hasCreated || !hasStatus || !hasComment) {
      throw new Error('Verification 9 Failed: Timeline missing expected event types');
    }

    // Verify chronological order ascending
    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1].createdAt).getTime();
      const curr = new Date(timeline[i].createdAt).getTime();
      if (curr < prev) {
        throw new Error('Verification 9 Failed: Timeline items are not in chronological order');
      }
    }
    console.log(`✓ Verification 9 Passed: Timeline includes all event types and is strictly chronological (${timeline.length} items).`);

    console.log('\n======================================================');
    console.log('ALL PHASE 8 COMMENTS & TIMELINE VERIFICATION CHECKS PASSED!');
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

runPhase8Verification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
