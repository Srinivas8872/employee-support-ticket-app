const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');
const { generateToken } = require('../utils/jwt');

describe('Phase 4: Ticket Status State Machine Integration Tests', () => {
  let mongoServer;
  let employee, supportUser;
  let empToken, supportToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await TicketActivity.deleteMany({});

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    employee = await User.create({
      name: 'Alice Employee',
      email: 'alice@company.com',
      password: hashedPassword,
      role: 'Employee',
    });

    supportUser = await User.create({
      name: 'Charlie Support',
      email: 'charlie.support@company.com',
      password: hashedPassword,
      role: 'Support',
    });

    empToken = generateToken(employee._id, employee.role);
    supportToken = generateToken(supportUser._id, supportUser.role);
  });

  it('rejects status update attempts by an Employee with 403 Forbidden (AC-12 / FR-STS-01)', async () => {
    const ticket = await Ticket.create({
      title: 'Broken mouse',
      description: 'Left click stuck.',
      category: 'Hardware',
      status: 'Open',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access denied');
  });

  it('allows Support Staff to advance status strictly forward (AC-13 / FR-STS-02)', async () => {
    const ticket = await Ticket.create({
      title: 'Power adapter replacement',
      description: 'Power cord frayed.',
      category: 'Hardware',
      status: 'Open',
      createdBy: employee._id,
    });

    const originalUpdatedAt = ticket.updatedAt.getTime();

    // 1. Open -> In Progress
    const res1 = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'In Progress' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('In Progress');

    // Verify activity logged
    const activity1 = await TicketActivity.findOne({
      ticketId: ticket._id,
      activityType: 'STATUS_CHANGED',
    });
    expect(activity1).toBeDefined();
    expect(activity1.details.previousValue).toBe('Open');
    expect(activity1.details.newValue).toBe('In Progress');

    // 2. In Progress -> Resolved
    const res2 = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'Resolved' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('Resolved');

    // 3. Resolved -> Closed
    const res3 = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'Closed' });

    expect(res3.status).toBe(200);
    expect(res3.body.data.status).toBe('Closed');

    // Verify updatedAt timestamp updated
    const finalTicket = await Ticket.findById(ticket._id);
    expect(finalTicket.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('rejects status skipping with 400 Bad Request (AC-14 / FR-STS-03)', async () => {
    const ticket = await Ticket.create({
      title: 'Network latency',
      description: 'High ping to gateway.',
      category: 'Network',
      status: 'Open',
      createdBy: employee._id,
    });

    // Attempt Open -> Resolved (skip)
    const resSkipToResolved = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'Resolved' });

    expect(resSkipToResolved.status).toBe(400);
    expect(resSkipToResolved.body.message).toContain('Invalid status transition');

    // Attempt Open -> Closed (skip)
    const resSkipToClosed = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'Closed' });

    expect(resSkipToClosed.status).toBe(400);
    expect(resSkipToClosed.body.message).toContain('Invalid status transition');
  });

  it('rejects backward transitions with 400 Bad Request (AC-14 / FR-STS-03)', async () => {
    const ticket = await Ticket.create({
      title: 'Resolved issue',
      description: 'Already resolved.',
      category: 'Software',
      status: 'Resolved',
      createdBy: employee._id,
    });

    // Attempt Resolved -> In Progress (backward)
    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid status transition');
  });

  it('rejects reopening or modifying status of Closed tickets with 409 Conflict (AC-15 / FR-STS-04)', async () => {
    const ticket = await Ticket.create({
      title: 'Closed issue',
      description: 'Completed and closed.',
      category: 'Hardware',
      status: 'Closed',
      createdBy: employee._id,
    });

    // Attempt Closed -> Open (reopen)
    const resOpen = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'Open' });

    expect(resOpen.status).toBe(409);
    expect(resOpen.body.message).toBe('Closed tickets cannot change status.');

    // Attempt Closed -> In Progress
    const resInProgress = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ status: 'In Progress' });

    expect(resInProgress.status).toBe(409);
    expect(resInProgress.body.message).toBe('Closed tickets cannot change status.');
  });
});
