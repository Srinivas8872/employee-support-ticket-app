const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

describe('Phase 3: Authentication & Authorization Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Setup an ephemeral test route to verify requireRole middleware in isolation
    app.get(
      '/api/test-support-only',
      requireAuth,
      requireRole(['Support']),
      (req, res) => {
        res.status(200).json({ success: true, message: 'Support authorized' });
      }
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('registers an employee successfully, hashes password, returns 201 and JWT (AC-01 / FR-AUTH-01 / FR-AUTH-03)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.name).toBe('Jane Doe');
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.role).toBe('Employee');
      expect(res.body.data.user.password).toBeUndefined();

      // Verify database record
      const dbUser = await User.findOne({ email: 'jane@example.com' }).select('+password');
      expect(dbUser).toBeDefined();
      expect(dbUser.password).toMatch(/^\$2[aby]\$\d+\$/);
      expect(dbUser.password).not.toBe('Password123!');
      const match = await bcrypt.compare('Password123!', dbUser.password);
      expect(match).toBe(true);
    });

    it('rejects passwords shorter than 8 characters with 400 (AC-02 / FR-AUTH-04)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: 'Pass123', // 7 chars
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 8 characters');
    });

    it('rejects invalid email formats with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('valid email address');
    });

    it('rejects missing or too short name with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'valid@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('between 2 and 50 characters');
    });

    it('enforces Employee role and blocks self-assignment of Support role (AC-01 / FR-AUTH-02)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker User',
          email: 'hacker@example.com',
          password: 'Password123!',
          role: 'Support', // Client attempts role elevation
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('Employee');

      const dbUser = await User.findOne({ email: 'hacker@example.com' });
      expect(dbUser.role).toBe('Employee');
    });

    it('returns 409 Conflict if email already exists', async () => {
      await User.create({
        name: 'Existing User',
        email: 'duplicate@example.com',
        password: await bcrypt.hash('Password123!', 10),
        role: 'Employee',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Person',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      await User.create({
        name: 'Alice Employee',
        email: 'alice@company.com',
        password: hashedPassword,
        role: 'Employee',
      });
    });

    it('returns 400 if email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@company.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@company.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('returns 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@company.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('logs in successfully, returns 200, JWT and profile without password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@company.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.name).toBe('Alice Employee');
      expect(res.body.data.user.email).toBe('alice@company.com');
      expect(res.body.data.user.role).toBe('Employee');
      expect(res.body.data.user.password).toBeUndefined();

      // Verify token decoded claims
      const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
      const decoded = jwt.verify(res.body.data.token, secret);
      expect(decoded.role).toBe('Employee');
      expect(decoded.userId).toBe(res.body.data.user.id);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const user = await User.create({
        name: 'Profile User',
        email: 'profile@company.com',
        password: hashedPassword,
        role: 'Employee',
      });
      userId = user._id.toString();
      const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
      token = jwt.sign({ userId, role: 'Employee' }, secret, { expiresIn: '24h' });
    });

    it('returns 401 if Authorization header is missing (NFR-SEC-01)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No token provided');
    });

    it('returns 401 if Bearer token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired token');
    });

    it('returns 401 if token has expired', async () => {
      const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
      const expiredToken = jwt.sign({ userId, role: 'Employee' }, secret, { expiresIn: '-1s' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and user profile without password for valid token (FR-AUTH-05)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(userId);
      expect(res.body.data.user.name).toBe('Profile User');
      expect(res.body.data.user.email).toBe('profile@company.com');
      expect(res.body.data.user.role).toBe('Employee');
      expect(res.body.data.user.password).toBeUndefined();
    });
  });

  describe('requireRole Middleware', () => {
    it('returns 403 Forbidden if user does not possess required role', async () => {
      const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
      const employeeToken = jwt.sign(
        { userId: new mongoose.Types.ObjectId(), role: 'Employee' },
        secret,
        { expiresIn: '24h' }
      );

      const res = await request(app)
        .get('/api/test-support-only')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('returns 200 OK if user possesses required Support role', async () => {
      const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
      const supportToken = jwt.sign(
        { userId: new mongoose.Types.ObjectId(), role: 'Support' },
        secret,
        { expiresIn: '24h' }
      );

      const res = await request(app)
        .get('/api/test-support-only')
        .set('Authorization', `Bearer ${supportToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Support authorized');
    });
  });
});
