const request = require('supertest');
const app = require('../server');

describe('Phase 1 Scaffolding Health Check', () => {
  it('GET /health returns 200 and healthy status message', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('healthy');
  });

  it('GET /api/health returns 200 and reachable message', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
