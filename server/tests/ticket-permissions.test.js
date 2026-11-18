const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');
const { generateToken } = require('../utils/jwt');

describe('Phase 4: Ticket Permissions & Creation Integration Tests', () => {
  let mongoServer;
  let employee1, employee2, supportUser;
  let emp1Token, emp2Token, supportToken;

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

  describe('POST /api/tickets (Ticket Creation)', () => {
    it('allows an Employee to create a ticket (AC-04 / FR-TCK-01 / FR-TCK-02)', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          title: 'Laptop display flickering',
          description: 'Screen randomly flashes black when HDMI is connected.',
          category: 'Hardware',
          priority: 'High',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Laptop display flickering');
      expect(res.body.data.status).toBe('Open');
      expect(res.body.data.category).toBe('Hardware');
      expect(res.body.data.priority).toBe('High');
      expect(res.body.data.createdBy._id.toString()).toBe(employee1._id.toString());
      expect(res.body.data.createdAt).toBeDefined();

      // Verify CREATED activity entry
      const activity = await TicketActivity.findOne({ ticketId: res.body.data._id });
      expect(activity).toBeDefined();
      expect(activity.activityType).toBe('CREATED');
      expect(activity.performedBy.toString()).toBe(employee1._id.toString());
    });

    it('allows Support Staff to create a ticket (AC-05 / FR-TCK-01)', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${supportToken}`)
        .send({
          title: 'Internal server patch needed',
          description: 'Apply security patch to dev node 3.',
          category: 'Software',
          priority: 'Medium',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('Open');
      expect(res.body.data.createdBy._id.toString()).toBe(supportUser._id.toString());
    });

    it('rejects title exceeding 100 characters with 400', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          title: 'x'.repeat(101),
          description: 'Valid description.',
          category: 'Hardware',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('100 characters');
    });

    it('rejects empty title or description with 400', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          title: '',
          description: '   ',
          category: 'Hardware',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid category enum with 400', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          title: 'Valid title',
          description: 'Valid description',
          category: 'InvalidCat',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid category');
    });
  });

  describe('GET /api/tickets (Listing & Ownership Scoping)', () => {
    beforeEach(async () => {
      // Create tickets for Employee 1
      await Ticket.create([
        {
          title: 'VPN timeout issue',
          description: 'Cannot connect to Cisco VPN.',
          category: 'Network',
          priority: 'High',
          status: 'Open',
          createdBy: employee1._id,
        },
        {
          title: 'Monitor resolution blur',
          description: '27-inch monitor scaling issue.',
          category: 'Hardware',
          priority: 'Low',
          status: 'Open',
          createdBy: employee1._id,
        },
      ]);

      // Create ticket for Employee 2
      await Ticket.create({
        title: 'VPN credentials reset',
        description: 'Need password reset on VPN gateway.',
        category: 'Network',
        priority: 'High',
        status: 'Open',
        createdBy: employee2._id,
      });
    });

    it('restricts Employee to viewing ONLY their own tickets (AC-06 / FR-TCK-03)', async () => {
      const res = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.length).toBe(2);
      res.body.data.tickets.forEach((t) => {
        expect(t.createdBy._id.toString()).toBe(employee1._id.toString());
      });
    });

    it('allows Support Staff to view ALL tickets across all employees (AC-07 / FR-TCK-04)', async () => {
      const res = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.length).toBe(3);
    });

    it('scopes search and filter queries for Employees strictly to own tickets (AC-19 / FR-SRCH-03)', async () => {
      // Employee 1 searches for 'VPN' (Both Emp 1 and Emp 2 have 'VPN' tickets)
      const res = await request(app)
        .get('/api/tickets?search=VPN')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.length).toBe(1);
      expect(res.body.data.tickets[0].title).toBe('VPN timeout issue');
    });

    it('searches globally across all employees for Support Staff (AC-20 / FR-SRCH-01 / FR-SRCH-02)', async () => {
      const res = await request(app)
        .get('/api/tickets?search=VPN')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.length).toBe(2);
    });
  });

  describe('GET /api/tickets/:id (Ticket Details & Access Guard)', () => {
    let emp2Ticket;

    beforeEach(async () => {
      emp2Ticket = await Ticket.create({
        title: 'Bob Private Access Request',
        description: 'Confidential folder access.',
        category: 'Access',
        priority: 'Medium',
        status: 'Open',
        createdBy: employee2._id,
      });
    });

    it('returns 403 Forbidden when Employee 1 tries to view Employee 2 ticket (AC-06 / FR-TCK-03)', async () => {
      const res = await request(app)
        .get(`/api/tickets/${emp2Ticket._id}`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('allows Employee 2 to view their own ticket', async () => {
      const res = await request(app)
        .get(`/api/tickets/${emp2Ticket._id}`)
        .set('Authorization', `Bearer ${emp2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Bob Private Access Request');
    });

    it('allows Support Staff to view any employee ticket', async () => {
      const res = await request(app)
        .get(`/api/tickets/${emp2Ticket._id}`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Bob Private Access Request');
    });

    it('returns 404 for non-existent ticket ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/tickets/${fakeId}`)
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Title & Description Immutability Check (FR-TCK-05)', () => {
    it('confirms that no general ticket update route exists (returns 404)', async () => {
      const ticket = await Ticket.create({
        title: 'Original Title',
        description: 'Original Description',
        category: 'Hardware',
        createdBy: employee1._id,
      });

      const putRes = await request(app)
        .put(`/api/tickets/${ticket._id}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ title: 'Tampered Title' });

      expect(putRes.status).toBe(404);

      const patchRes = await request(app)
        .patch(`/api/tickets/${ticket._id}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .send({ title: 'Tampered Title' });

      expect(patchRes.status).toBe(404);
    });
  });
});
