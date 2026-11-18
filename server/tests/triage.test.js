const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');
const { generateToken } = require('../utils/jwt');

describe('Phase 4: Ticket Triage Integration Tests', () => {
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

  it('rejects triage modification by an Employee with 403 Forbidden (AC-10 / FR-TCK-06)', async () => {
    const ticket = await Ticket.create({
      title: 'Headphones crackling',
      description: 'Audio cuts in and out.',
      category: 'Other',
      priority: 'Low',
      status: 'Open',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ category: 'Hardware', priority: 'High' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access denied');
  });

  it('allows Support Staff to update category and priority on an Open ticket (AC-08 / FR-TCK-06)', async () => {
    const ticket = await Ticket.create({
      title: 'Misclassified issue',
      description: 'Logged under Other by mistake.',
      category: 'Other',
      priority: 'Low',
      status: 'Open',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ category: 'Software', priority: 'Medium' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('Software');
    expect(res.body.data.priority).toBe('Medium');

    // Verify TRIAGED activity recorded
    const activity = await TicketActivity.findOne({
      ticketId: ticket._id,
      activityType: 'TRIAGED',
    });
    expect(activity).toBeDefined();
    expect(activity.performedBy.toString()).toBe(supportUser._id.toString());
  });

  it('allows Support Staff to triage tickets in In Progress status (AC-08 / FR-TCK-06)', async () => {
    const ticket = await Ticket.create({
      title: 'Ongoing investigation',
      description: 'Discovered this is a network hardware issue.',
      category: 'Software',
      priority: 'Medium',
      status: 'In Progress',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ category: 'Network', priority: 'High' });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toBe('Network');
    expect(res.body.data.priority).toBe('High');
  });

  it('rejects triage on Resolved tickets with 409 Conflict (AC-09 / FR-TCK-06)', async () => {
    const ticket = await Ticket.create({
      title: 'Resolved ticket',
      description: 'Resolution already delivered.',
      category: 'Software',
      priority: 'Medium',
      status: 'Resolved',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ category: 'Hardware' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Resolved or Closed');
  });

  it('rejects triage on Closed tickets with 409 Conflict (AC-09 / FR-TCK-07)', async () => {
    const ticket = await Ticket.create({
      title: 'Closed ticket',
      description: 'Case is closed.',
      category: 'Access',
      priority: 'Low',
      status: 'Closed',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ priority: 'High' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Resolved or Closed');
  });

  it('rejects invalid category or priority with 400 Bad Request', async () => {
    const ticket = await Ticket.create({
      title: 'Open ticket',
      description: 'Test',
      category: 'Hardware',
      priority: 'Low',
      status: 'Open',
      createdBy: employee._id,
    });

    const resBadCategory = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ category: 'BadCategory' });

    expect(resBadCategory.status).toBe(400);

    const resBadPriority = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ priority: 'Urgent' });

    expect(resBadPriority.status).toBe(400);
  });

  it('rejects empty triage payload with 400 Bad Request', async () => {
    const ticket = await Ticket.create({
      title: 'Open ticket',
      description: 'Test',
      category: 'Hardware',
      priority: 'Low',
      status: 'Open',
      createdBy: employee._id,
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/triage`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('At least one field');
  });
});
