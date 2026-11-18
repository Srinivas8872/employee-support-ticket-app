const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const { seedDatabase, validateSafetyGuards } = require('../scripts/seed');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketActivity = require('../models/TicketActivity');

describe('Phase 2: Database Seeder & Safety Guards Verification', () => {
  let mongoServer;
  let testMongoUri;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    testMongoUri = mongoServer.getUri();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('3-Layer Safety Guards', () => {
    it('Layer 1: Aborts immediately if NODE_ENV is production', () => {
      const mockEnv = {
        NODE_ENV: 'production',
        ALLOW_SEED_RESET: 'true',
        MONGODB_URI: 'mongodb://localhost:27017/ticket_app_dev',
      };

      expect(() => validateSafetyGuards(mockEnv)).toThrow(
        /CRITICAL ABORT: Database seeding is forbidden in production environments/
      );
    });

    it('Layer 2: Aborts immediately if ALLOW_SEED_RESET is not true', () => {
      const mockEnv = {
        NODE_ENV: 'development',
        ALLOW_SEED_RESET: 'false',
        MONGODB_URI: 'mongodb://localhost:27017/ticket_app_dev',
      };

      expect(() => validateSafetyGuards(mockEnv)).toThrow(
        /Set ALLOW_SEED_RESET=true to confirm/
      );
    });

    it('Layer 3: Aborts immediately if database URI is not local or dev/test', () => {
      const mockEnv = {
        NODE_ENV: 'development',
        ALLOW_SEED_RESET: 'true',
        MONGODB_URI: 'mongodb+srv://prod-admin:secret@prod-cluster.mongodb.net/production_db',
      };

      expect(() => validateSafetyGuards(mockEnv)).toThrow(
        /Database target must be a local or explicit development\/test database/
      );
    });

    it('Passes validation when all safety criteria are satisfied', () => {
      const mockEnv = {
        NODE_ENV: 'development',
        ALLOW_SEED_RESET: 'true',
        MONGODB_URI: 'mongodb://localhost:27017/ticket_app_dev',
      };

      expect(() => validateSafetyGuards(mockEnv)).not.toThrow();
    });
  });

  describe('Seed Execution & Data Integrity', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_SEED_RESET = 'true';
      process.env.MONGODB_URI = testMongoUri;
    });

    it('seeds 4 users with bcrypt-hashed passwords and 5 sample tickets', async () => {
      const result = await seedDatabase(testMongoUri);

      // Verify Users
      const users = await User.find().select('+password');
      expect(users.length).toBe(4);

      const employees = users.filter((u) => u.role === 'Employee');
      const support = users.filter((u) => u.role === 'Support');
      expect(employees.length).toBe(2);
      expect(support.length).toBe(2);

      const emails = users.map((u) => u.email).sort();
      expect(emails).toEqual([
        'alice@company.com',
        'bob@company.com',
        'charlie.support@company.com',
        'diana.support@company.com',
      ]);

      // Verify that passwords are fully bcrypt-hashed and verify against 'Password123!'
      for (const user of users) {
        expect(user.password).toMatch(/^\$2[aby]\$\d+\$/);
        const match = await bcrypt.compare('Password123!', user.password);
        expect(match).toBe(true);
      }

      // Verify the 5 Sample Tickets
      const tickets = await Ticket.find().sort({ createdAt: 1 });
      expect(tickets.length).toBe(5);

      const sample1 = tickets.find((t) => t.title === 'Laptop not charging');
      expect(sample1).toBeDefined();
      expect(sample1.category).toBe('Hardware');
      expect(sample1.priority).toBe('High');
      expect(sample1.status).toBe('Open');

      const sample2 = tickets.find((t) => t.title === 'Cannot log in to VPN');
      expect(sample2).toBeDefined();
      expect(sample2.category).toBe('Network');
      expect(sample2.priority).toBe('High');
      expect(sample2.status).toBe('In Progress');

      const sample3 = tickets.find(
        (t) => t.title === 'Need access to the shared project folder'
      );
      expect(sample3).toBeDefined();
      expect(sample3.category).toBe('Access');
      expect(sample3.priority).toBe('Medium');
      expect(sample3.status).toBe('Open');

      const sample4 = tickets.find(
        (t) => t.title === 'Excel keeps crashing on startup'
      );
      expect(sample4).toBeDefined();
      expect(sample4.category).toBe('Software');
      expect(sample4.priority).toBe('Medium');
      expect(sample4.status).toBe('Resolved');

      const sample5 = tickets.find((t) => t.title === 'Request a second monitor');
      expect(sample5).toBeDefined();
      expect(sample5.category).toBe('Hardware');
      expect(sample5.priority).toBe('Low');
      expect(sample5.status).toBe('Closed');

      // Verify activities were created
      const activities = await TicketActivity.find();
      expect(activities.length).toBeGreaterThanOrEqual(5);
    });
  });
});
