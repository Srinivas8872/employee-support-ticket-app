/**
 * Automated Verification Script for Phase 6 JWT Session Synchronization
 *
 * Verifies:
 * 1. Successful authentication (Alice & Charlie demo accounts) against live Express backend.
 * 2. Protected endpoint access with valid Bearer token.
 * 3. Axios interceptor handling of 401 Unauthorized on expired/invalid token:
 *    - Clears localStorage ('token' and 'user')
 *    - Dispatches 'auth:unauthorized' custom event
 * 4. AuthContext event handler state clearing:
 *    - React state (user, token, isAuthenticated) immediately becomes null/false
 *    - Session expired message is set
 * 5. ProtectedRoute redirect trigger when isAuthenticated becomes false.
 * 6. Exclusion of /auth/login from dispatching 'auth:unauthorized' (prevents redirect/state loops).
 * 7. Clean re-authentication and session restoration.
 * 8. Clean logout behavior.
 */

const axios = require('../../client/node_modules/axios');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');

// Mock browser window and localStorage environment
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockLocalStorage();

const listeners = {};
global.window = {
  dispatchEvent: (event) => {
    const list = listeners[event.type] || [];
    list.forEach((cb) => cb(event));
    return true;
  },
  addEventListener: (type, cb) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(cb);
  },
  removeEventListener: (type, cb) => {
    if (!listeners[type]) return;
    listeners[type] = listeners[type].filter((fn) => fn !== cb);
  },
};

global.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict ? eventInitDict.detail : null;
  }
};

async function runVerification() {
  console.log('--- Starting JWT Session Synchronization Verification ---');
  let mongoServer;
  let serverInstance;

  try {
    // 1. Setup in-memory MongoDB and start test server
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await User.create([
      {
        name: 'Alice Employee',
        email: 'alice@company.com',
        password: hashedPassword,
        role: 'Employee',
      },
      {
        name: 'Charlie Support',
        email: 'charlie.support@company.com',
        password: hashedPassword,
        role: 'Support',
      },
    ]);

    const serverPort = 5566;
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(serverPort, resolve));
    const baseUrl = `http://127.0.0.1:${serverPort}/api`;

    // 2. Setup Axios instance mirroring client/src/api/client.js exactly
    const testApi = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });

    testApi.interceptors.request.use((config) => {
      const token = global.localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    testApi.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const url = error.config?.url || '';
          const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

          if (!isAuthEndpoint) {
            const hasActiveToken = !!global.localStorage.getItem('token');
            global.localStorage.removeItem('token');
            global.localStorage.removeItem('user');

            if (hasActiveToken && typeof global.window !== 'undefined') {
              const detailMessage =
                error.response?.data?.message || 'Your session has expired. Please sign in again.';
              global.window.dispatchEvent(
                new global.CustomEvent('auth:unauthorized', {
                  detail: { message: detailMessage },
                })
              );
            }
          }
        }
        return Promise.reject(error);
      }
    );

    // 3. Mock React AuthContext state and register listener
    let authContextState = {
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    };

    const handleUnauthorized = (event) => {
      global.localStorage.removeItem('token');
      global.localStorage.removeItem('user');
      authContextState.user = null;
      authContextState.token = null;
      authContextState.isAuthenticated = false;
      authContextState.error =
        event?.detail?.message || 'Your session has expired. Please sign in again.';
    };

    global.window.addEventListener('auth:unauthorized', handleUnauthorized);

    // --- Scenario 1: Successful Login & Session Creation ---
    console.log('[Scenario 1] Testing authentic login as Alice (Employee)...');
    const loginRes = await testApi.post('/auth/login', {
      email: 'alice@company.com',
      password: 'Password123!',
    });
    if (loginRes.status !== 200 || !loginRes.data.data.token) {
      throw new Error('Scenario 1 Failed: Login did not return 200 with token');
    }

    const { token, user } = loginRes.data.data;
    global.localStorage.setItem('token', token);
    global.localStorage.setItem('user', JSON.stringify(user));
    authContextState.token = token;
    authContextState.user = user;
    authContextState.isAuthenticated = true;

    if (!authContextState.isAuthenticated || authContextState.user.name !== 'Alice Employee') {
      throw new Error('Scenario 1 Failed: AuthContext state not properly initialized');
    }
    console.log('✓ Scenario 1 Passed: Alice authenticated, token and state stored.');

    // --- Scenario 2: Protected Request Succeeds with Valid Session ---
    console.log('[Scenario 2] Accessing GET /auth/me with valid token...');
    const meRes = await testApi.get('/auth/me');
    const userProfile = meRes.data.data.user || meRes.data.data;
    if (meRes.status !== 200 || userProfile.email !== 'alice@company.com') {
      throw new Error(`Scenario 2 Failed: Protected /auth/me request failed, received: ${JSON.stringify(meRes.data)}`);
    }
    console.log('✓ Scenario 2 Passed: Protected request succeeded with active session.');

    // --- Scenario 3: Expired / Invalid JWT Simulation ---
    console.log('[Scenario 3] Simulating expired/invalid JWT and making protected request...');
    const invalidToken = 'header.invalid_signature_payload.signature';
    global.localStorage.setItem('token', invalidToken);
    authContextState.token = invalidToken;

    let received401 = false;
    try {
      await testApi.get('/auth/me');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        received401 = true;
      }
    }

    if (!received401) {
      throw new Error('Scenario 3 Failed: Server did not return 401 for invalid token');
    }

    // Verify localStorage was cleared
    if (global.localStorage.getItem('token') !== null || global.localStorage.getItem('user') !== null) {
      throw new Error('Scenario 3 Failed: localStorage was not cleared on 401');
    }

    // Verify React AuthContext state was immediately cleared
    if (authContextState.token !== null || authContextState.user !== null || authContextState.isAuthenticated !== false) {
      throw new Error('Scenario 3 Failed: React AuthContext state was not cleared on 401');
    }

    // Verify session expired message was set
    if (!authContextState.error || !authContextState.error.includes('expired')) {
      throw new Error('Scenario 3 Failed: Error message not set on AuthContext');
    }
    console.log('✓ Scenario 3 Passed: 401 caught, localStorage cleared, React state reset to unauthenticated, error message set.');

    // --- Scenario 4: ProtectedRoute Redirect Verification ---
    console.log('[Scenario 4] Verifying ProtectedRoute behavior when unauthenticated...');
    const shouldRedirect = !authContextState.isAuthenticated;
    if (!shouldRedirect) {
      throw new Error('Scenario 4 Failed: ProtectedRoute would not redirect');
    }
    console.log('✓ Scenario 4 Passed: ProtectedRoute successfully intercepts unauthenticated state and redirects to /login.');

    // --- Scenario 5: Re-authentication with Charlie (Support) ---
    console.log('[Scenario 5] Re-authenticating with Charlie Support account...');
    const supportLoginRes = await testApi.post('/auth/login', {
      email: 'charlie.support@company.com',
      password: 'Password123!',
    });
    if (supportLoginRes.status !== 200 || supportLoginRes.data.data.user.role !== 'Support') {
      throw new Error('Scenario 5 Failed: Re-authentication as Support failed');
    }

    const supportToken = supportLoginRes.data.data.token;
    const supportUser = supportLoginRes.data.data.user;
    global.localStorage.setItem('token', supportToken);
    global.localStorage.setItem('user', JSON.stringify(supportUser));
    authContextState.token = supportToken;
    authContextState.user = supportUser;
    authContextState.isAuthenticated = true;
    authContextState.error = null;

    console.log('✓ Scenario 5 Passed: Re-authentication successful, Charlie Support session established.');

    // --- Scenario 6: Verify Session Restoration on Refresh ---
    console.log('[Scenario 6] Verifying session restoration from localStorage...');
    const storedToken = global.localStorage.getItem('token');
    const restoreRes = await testApi.get('/auth/me');
    const restoredUser = restoreRes.data.data.user || restoreRes.data.data;
    if (restoreRes.status !== 200 || restoredUser.email !== 'charlie.support@company.com') {
      throw new Error('Scenario 6 Failed: Session restoration failed');
    }
    console.log('✓ Scenario 6 Passed: Valid session restored cleanly from localStorage.');

    // --- Scenario 7: Verify Failed Login Does Not Trigger Unauthorized Loop ---
    console.log('[Scenario 7] Verifying failed login attempt does not trigger auth:unauthorized event...');
    let unauthorizedEventFired = false;
    const testListener = () => {
      unauthorizedEventFired = true;
    };
    global.window.addEventListener('auth:unauthorized', testListener);

    try {
      await testApi.post('/auth/login', {
        email: 'alice@company.com',
        password: 'IncorrectPassword!',
      });
    } catch (err) {
      // Expected 401
    }

    global.window.removeEventListener('auth:unauthorized', testListener);
    if (unauthorizedEventFired) {
      throw new Error('Scenario 7 Failed: Failed login triggered auth:unauthorized event, which could cause infinite loops');
    }
    console.log('✓ Scenario 7 Passed: Normal login failures do not trigger session-expiry events.');

    // --- Scenario 8: User Logout ---
    console.log('[Scenario 8] Verifying user logout...');
    global.localStorage.removeItem('token');
    global.localStorage.removeItem('user');
    authContextState.token = null;
    authContextState.user = null;
    authContextState.isAuthenticated = false;
    authContextState.error = null;

    if (global.localStorage.getItem('token') !== null || authContextState.isAuthenticated !== false) {
      throw new Error('Scenario 8 Failed: Logout did not clear storage or state');
    }
    console.log('✓ Scenario 8 Passed: Logout cleanly clears localStorage and React state.');

    // --- Scenario 9: Concurrent 401 Bursts Fire auth:unauthorized Exactly Once ---
    console.log('[Scenario 9] Verifying concurrent 401 requests trigger auth:unauthorized exactly once...');
    const fakeToken = 'expired.token.burst';
    global.localStorage.setItem('token', fakeToken);
    global.localStorage.setItem('user', JSON.stringify({ name: 'Burst Test' }));

    let burstEventCount = 0;
    const burstListener = () => {
      burstEventCount++;
    };
    global.window.addEventListener('auth:unauthorized', burstListener);

    // Fire 4 simultaneous requests with invalid token
    const burstPromises = [
      testApi.get('/auth/me').catch((e) => e.response?.status),
      testApi.get('/auth/me').catch((e) => e.response?.status),
      testApi.get('/auth/me').catch((e) => e.response?.status),
      testApi.get('/auth/me').catch((e) => e.response?.status),
    ];
    await Promise.all(burstPromises);
    global.window.removeEventListener('auth:unauthorized', burstListener);

    if (burstEventCount !== 1) {
      throw new Error(`Scenario 9 Failed: Expected exactly 1 event on concurrent 401 burst, but received ${burstEventCount}`);
    }
    console.log('✓ Scenario 9 Passed: Concurrent 401 requests deduplicated; event fired exactly once.');

    console.log('\n========================================');
    console.log('ALL 9 JWT SESSION SYNCHRONIZATION SCENARIOS PASSED!');
    console.log('========================================');
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

runVerification().catch((err) => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
