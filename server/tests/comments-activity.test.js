const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const TicketActivity = require('../models/TicketActivity');
const { generateToken } = require('../utils/jwt');

describe('Phase 5: Backend Comments & Activity Timeline Integration Tests', () => {
  let mongoServer;
  let employee1, employee2, supportUser;
  let emp1Token, emp2Token, supportToken;

  beforeAll(async () => {
    // Replica set is required to support MongoDB sessions and transactions
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await TicketActivity.deleteMany({});

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    employee1 = await User.create({
      name: 'Alice Employee',
      email: 'alice@company.com',
      password: hashedPassword,
      role: 'Employee',
    });

    employee2 = await User.create({
      name: 'Bob Employee',
      email: 'bob@company.com',
      password: hashedPassword,
      role: 'Employee',
    });

    supportUser = await User.create({
      name: 'Charlie Support',
      email: 'charlie.support@company.com',
      password: hashedPassword,
      role: 'Support',
    });

    emp1Token = generateToken(employee1._id, employee1.role);
    emp2Token = generateToken(employee2._id, employee2.role);
    supportToken = generateToken(supportUser._id, supportUser.role);
  });

  describe('POST /api/tickets/:id/comments - Comment Creation & Permissions', () => {
    it('allows an Employee to add a comment to their own ticket (AC-18 / FR-CMT-01)', async () => {
      const ticket = await Ticket.create({
        title: 'Printer paper jam',
        description: 'Tray 2 is stuck.',
        category: 'Hardware',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'I tried clearing the rollers but it did not help.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('I tried clearing the rollers but it did not help.');
      expect(res.body.data.author._id.toString()).toBe(employee1._id.toString());
      expect(res.body.data.author.name).toBe('Alice Employee');
      expect(res.body.data.author.role).toBe('Employee');
      expect(res.body.message).toBe('Comment added successfully');
    });

    it('allows Support Staff to comment on any employee ticket (AC-18 / FR-CMT-01)', async () => {
      const ticket = await Ticket.create({
        title: 'Printer paper jam',
        description: 'Tray 2 is stuck.',
        category: 'Hardware',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ content: 'Maintenance technician dispatched to floor 3.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Maintenance technician dispatched to floor 3.');
      expect(res.body.data.author._id.toString()).toBe(supportUser._id.toString());
      expect(res.body.data.author.name).toBe('Charlie Support');
      expect(res.body.data.author.role).toBe('Support');
    });

    it('denies an Employee commenting on another employee ticket with 403 Forbidden (AC-18 / FR-CMT-02)', async () => {
      const ticket = await Ticket.create({
        title: 'Alice confidential ticket',
        description: 'Payroll query.',
        category: 'Access',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp2Token}`)
        .send({ content: 'Bob attempting unauthorized comment' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');

      // Verify no comment was created
      const count = await Comment.countDocuments({ ticketId: ticket._id });
      expect(count).toBe(0);
    });

    it('allows adding comments on tickets in Closed status (AC-19 / FR-CMT-03)', async () => {
      const ticket = await Ticket.create({
        title: 'Old closed issue',
        description: 'Completed last week.',
        category: 'Software',
        status: 'Closed',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Follow-up question regarding the closed resolution.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Follow-up question regarding the closed resolution.');
    });

    it('rejects empty or whitespace-only comment with 400 Bad Request (AC-20 / FR-CMT-04)', async () => {
      const ticket = await Ticket.create({
        title: 'Ticket for validation test',
        description: 'Test description.',
        category: 'Other',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res1 = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: '' });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.message).toContain('Comment content cannot be empty');

      const res2 = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: '    ' });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toContain('Comment content cannot be empty');
    });

    it('rejects comment exceeding 1000 characters with 400 Bad Request (AC-20 / FR-CMT-04)', async () => {
      const ticket = await Ticket.create({
        title: 'Ticket for length test',
        description: 'Test description.',
        category: 'Other',
        status: 'Open',
        createdBy: employee1._id,
      });

      const longContent = 'A'.repeat(1001);

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: longContent });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Comment cannot exceed 1000 characters');
    });

    it('returns 404 when commenting on a non-existent ticket', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/tickets/${nonExistentId}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Comment on non-existent ticket' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Ticket not found');
    });

    it('returns 401 when unauthenticated user attempts to comment', async () => {
      const ticket = await Ticket.create({
        title: 'Unauthenticated test',
        description: 'Test description.',
        category: 'Other',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .send({ content: 'Unauthenticated comment' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Atomicity, Persistence & Append-Only Guarantees', () => {
    it('persists exactly one comment and one COMMENTED TicketActivity event atomically (AC-21 / FR-ACT-01)', async () => {
      const ticket = await Ticket.create({
        title: 'Atomic persistence ticket',
        description: 'Testing atomic comment and activity persistence.',
        category: 'Software',
        status: 'In Progress',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Testing atomic database session write.' });

      expect(res.status).toBe(201);

      // Verify exactly one comment exists in comments collection
      const comments = await Comment.find({ ticketId: ticket._id });
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('Testing atomic database session write.');
      expect(comments[0].author.toString()).toBe(employee1._id.toString());

      // Verify exactly one COMMENTED TicketActivity event exists in ticketactivities collection
      const activities = await TicketActivity.find({
        ticketId: ticket._id,
        activityType: 'COMMENTED',
      });
      expect(activities.length).toBe(1);
      expect(activities[0].performedBy.toString()).toBe(employee1._id.toString());
      expect(activities[0].details.message).toBe('Comment added');
    });

    it('aborts transaction and leaves no partial records on unexpected failure (AC-21 / FR-ACT-01)', async () => {
      const ticket = await Ticket.create({
        title: 'Transaction rollback ticket',
        description: 'Testing rollback safety.',
        category: 'Hardware',
        status: 'Open',
        createdBy: employee1._id,
      });

      // Spy on TicketActivity.create to simulate an unexpected error during the transaction
      const originalCreate = TicketActivity.create;
      jest.spyOn(TicketActivity, 'create').mockImplementationOnce(async () => {
        throw new Error('Simulated database write failure during activity creation');
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket._id}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'This comment must be rolled back.' });

      expect(res.status).toBe(500);

      // Restore original create method
      TicketActivity.create = originalCreate;

      // Verify that NO partial comment document was persisted due to transaction rollback
      const comments = await Comment.find({ ticketId: ticket._id });
      expect(comments.length).toBe(0);

      // Verify that NO partial activity document was persisted
      const activities = await TicketActivity.find({
        ticketId: ticket._id,
        activityType: 'COMMENTED',
      });
      expect(activities.length).toBe(0);
    });

    it('enforces append-only comments with no PUT, PATCH, or DELETE endpoints (AC-22 / FR-CMT-05)', async () => {
      const ticket = await Ticket.create({
        title: 'Immutable comment ticket',
        description: 'Checking absence of edit/delete routes.',
        category: 'Access',
        status: 'Open',
        createdBy: employee1._id,
      });

      const comment = await Comment.create({
        ticketId: ticket._id,
        author: employee1._id,
        content: 'Original immutable comment',
      });

      // PUT attempt to edit comment -> 404 Not Found
      const putRes = await request(app)
        .put(`/api/tickets/${ticket._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Attempted edit' });
      expect(putRes.status).toBe(404);

      // PATCH attempt to edit comment -> 404 Not Found
      const patchRes = await request(app)
        .patch(`/api/tickets/${ticket._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Attempted patch' });
      expect(patchRes.status).toBe(404);

      // DELETE attempt to delete comment -> 404 Not Found
      const deleteRes = await request(app)
        .delete(`/api/tickets/${ticket._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${emp1Token}`);
      expect(deleteRes.status).toBe(404);

      // Verify original comment remains completely unchanged
      const persisted = await Comment.findById(comment._id);
      expect(persisted.content).toBe('Original immutable comment');
    });
  });

  describe('GET /api/tickets/:id/timeline - Chronological Activity & Comment Timeline', () => {
    it('returns unified chronological timeline of activities and comments (AC-23 / FR-ACT-02)', async () => {
      // Step 1: Create ticket via API (generates CREATED activity)
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          title: 'Laptop display flickering',
          description: 'Screen flickers when moved.',
          category: 'Hardware',
          priority: 'High',
        });
      expect(createRes.status).toBe(201);
      const ticketId = createRes.body.data._id;

      // Small delay to guarantee distinct timestamps for clean ordering
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Step 2: Advance status to In Progress (generates STATUS_CHANGED activity)
      const statusRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ status: 'In Progress' });
      expect(statusRes.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Step 3: Add comment from Employee
      const comment1Res = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ content: 'Flickering happens especially on battery power.' });
      expect(comment1Res.status).toBe(201);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Step 4: Triage ticket priority to Medium (generates TRIAGED activity)
      const triageRes = await request(app)
        .patch(`/api/tickets/${ticketId}/triage`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ priority: 'Medium' });
      expect(triageRes.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Step 5: Add comment from Support
      const comment2Res = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ content: 'Please bring the laptop to IT desk room 204.' });
      expect(comment2Res.status).toBe(201);

      // Step 6: Fetch timeline
      const timelineRes = await request(app)
        .get(`/api/tickets/${ticketId}/timeline`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(timelineRes.status).toBe(200);
      expect(timelineRes.body.success).toBe(true);

      const timeline = timelineRes.body.data;
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBe(5);

      // Verify sequence of event types
      expect(timeline[0].activityType).toBe('CREATED');
      expect(timeline[0].type).toBe('ACTIVITY');
      expect(timeline[0].performedBy.name).toBe('Alice Employee');

      expect(timeline[1].activityType).toBe('STATUS_CHANGED');
      expect(timeline[1].type).toBe('ACTIVITY');
      expect(timeline[1].details.newValue).toBe('In Progress');

      expect(timeline[2].activityType).toBe('COMMENTED');
      expect(timeline[2].type).toBe('COMMENT');
      expect(timeline[2].content).toBe('Flickering happens especially on battery power.');
      expect(timeline[2].author.name).toBe('Alice Employee');

      expect(timeline[3].activityType).toBe('TRIAGED');
      expect(timeline[3].type).toBe('ACTIVITY');
      expect(timeline[3].details.newValue).toContain('Medium');

      expect(timeline[4].activityType).toBe('COMMENTED');
      expect(timeline[4].type).toBe('COMMENT');
      expect(timeline[4].content).toBe('Please bring the laptop to IT desk room 204.');
      expect(timeline[4].author.name).toBe('Charlie Support');

      // Verify strictly ascending chronological timestamps
      for (let i = 1; i < timeline.length; i++) {
        const prevTime = new Date(timeline[i - 1].createdAt).getTime();
        const currTime = new Date(timeline[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('allows Support Staff to view the timeline of any ticket', async () => {
      const ticket = await Ticket.create({
        title: 'Support timeline check',
        description: 'Test description.',
        category: 'Other',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .get(`/api/tickets/${ticket._id}/timeline`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('denies an Employee from viewing another employee ticket timeline with 403 Forbidden', async () => {
      const ticket = await Ticket.create({
        title: 'Alice private ticket',
        description: 'Confidential details.',
        category: 'Access',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app)
        .get(`/api/tickets/${ticket._id}/timeline`)
        .set('Authorization', `Bearer ${emp2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('returns 404 when requesting timeline for a non-existent ticket', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/tickets/${nonExistentId}/timeline`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Ticket not found');
    });

    it('returns 401 when requesting timeline without authentication token', async () => {
      const ticket = await Ticket.create({
        title: 'Unauthenticated timeline test',
        description: 'Test description.',
        category: 'Other',
        status: 'Open',
        createdBy: employee1._id,
      });

      const res = await request(app).get(`/api/tickets/${ticket._id}/timeline`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
