const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const TicketActivity = require('../models/TicketActivity');

describe('Phase 2: Mongoose Database Models Validation', () => {
  let mongoServer;

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
    await Comment.deleteMany({});
    await TicketActivity.deleteMany({});
  });

  describe('User Model', () => {
    it('creates a valid employee user with default role', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
      });

      expect(user.role).toBe('Employee');
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const user = new User({
        name: 'Short Pass',
        email: 'short@example.com',
        password: 'pass123',
      });

      let err;
      try {
        await user.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.password.message).toContain('at least 8 characters');
    });

    it('rejects invalid email formats', async () => {
      const user = new User({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'Password123!',
      });

      let err;
      try {
        await user.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });

    it('rejects invalid roles', async () => {
      const user = new User({
        name: 'Admin Want',
        email: 'admin@example.com',
        password: 'Password123!',
        role: 'Admin', // Not in ['Employee', 'Support']
      });

      let err;
      try {
        await user.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.role).toBeDefined();
    });

    it('compares passwords correctly using comparePassword method', async () => {
      const password = 'SecretPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name: 'Auth Test',
        email: 'auth@example.com',
        password: hashedPassword,
      });

      // Fetch user with password field explicitly selected
      const fetched = await User.findById(user._id).select('+password');
      const isMatch = await fetched.comparePassword(password);
      const isBadMatch = await fetched.comparePassword('WrongPassword!');

      expect(isMatch).toBe(true);
      expect(isBadMatch).toBe(false);
    });

    it('omits password field by default on query (select: false)', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const user = await User.create({
        name: 'Secret User',
        email: 'secret@example.com',
        password: hashedPassword,
      });

      const found = await User.findById(user._id);
      expect(found.password).toBeUndefined();
    });
  });

  describe('Ticket Model', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Ticket Creator',
        email: 'creator@example.com',
        password: await bcrypt.hash('Password123!', 10),
      });
    });

    it('creates a valid ticket with default status Open and priority Medium', async () => {
      const ticket = await Ticket.create({
        title: 'Printer paper jam',
        description: 'Tray 2 is stuck with a jam.',
        category: 'Hardware',
        createdBy: testUser._id,
      });

      expect(ticket.status).toBe('Open');
      expect(ticket.priority).toBe('Medium');
      expect(ticket.createdAt).toBeDefined();
      expect(ticket.updatedAt).toBeDefined();
    });

    it('rejects ticket title exceeding 100 characters', async () => {
      const longTitle = 'a'.repeat(101);
      const ticket = new Ticket({
        title: longTitle,
        description: 'Description',
        category: 'Hardware',
        createdBy: testUser._id,
      });

      let err;
      try {
        await ticket.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.title.message).toContain('100 characters');
    });

    it('rejects invalid category or priority values', async () => {
      const ticket = new Ticket({
        title: 'Invalid values',
        description: 'Test',
        category: 'NonExistentCategory',
        priority: 'Urgent', // Only Low, Medium, High allowed
        createdBy: testUser._id,
      });

      let err;
      try {
        await ticket.validate();
      } catch (error) {
        err = error;
      }

      expect(err).toBeDefined();
      expect(err.errors.category).toBeDefined();
      expect(err.errors.priority).toBeDefined();
    });
  });

  describe('Comment Model', () => {
    it('creates a comment and enforces max length 1000', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const validComment = new Comment({
        ticketId: dummyId,
        author: dummyId,
        content: 'This is a helpful update.',
      });
      await expect(validComment.validate()).resolves.toBeUndefined();

      const tooLongComment = new Comment({
        ticketId: dummyId,
        author: dummyId,
        content: 'x'.repeat(1001),
      });
      await expect(tooLongComment.validate()).rejects.toThrow();
    });
  });

  describe('TicketActivity Model', () => {
    it('creates an activity entry with valid activityType and details message', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const activity = new TicketActivity({
        ticketId: dummyId,
        performedBy: dummyId,
        activityType: 'STATUS_CHANGED',
        details: {
          previousValue: 'Open',
          newValue: 'In Progress',
          message: 'Status updated from Open to In Progress',
        },
      });

      await expect(activity.validate()).resolves.toBeUndefined();
    });

    it('rejects invalid activityType', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const activity = new TicketActivity({
        ticketId: dummyId,
        performedBy: dummyId,
        activityType: 'INVALID_TYPE',
        details: { message: 'Some message' },
      });

      await expect(activity.validate()).rejects.toThrow();
    });
  });
});
