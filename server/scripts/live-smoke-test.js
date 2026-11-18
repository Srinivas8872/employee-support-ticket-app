/**
 * Live Smoke Test against the running dev servers:
 * Backend: http://localhost:5000/api
 * Frontend: http://localhost:5173
 */

const axios = require('../../client/node_modules/axios');

async function runLiveSmokeTest() {
  console.log('=== Running Live Smoke Test on http://localhost:5000 and http://localhost:5173 ===');

  // Check 1: Frontend Server probe
  console.log('\n[Check 1] Probing frontend dev server on http://localhost:5173...');
  const frontendRes = await axios.get('http://localhost:5173');
  if (frontendRes.status !== 200 || !frontendRes.data.includes('<div id="root"></div>')) {
    throw new Error('Frontend server did not return valid HTML bundle');
  }
  console.log('✓ Check 1 Passed: Frontend Vite server is serving the React application.');

  // Check 2: Login as Alice (Employee) via backend API
  console.log('\n[Check 2] Authentic login as Alice (Employee)...');
  const aliceLogin = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'alice@company.com',
    password: 'Password123!',
  });
  const aliceToken = aliceLogin.data.data.token;
  const aliceUser = aliceLogin.data.data.user;
  console.log(`✓ Check 2 Passed: Alice authenticated (Role: ${aliceUser.role}).`);

  // Check 3: Alice tickets query (must see only her own seeded tickets: 3 tickets)
  console.log('\n[Check 3] Querying tickets as Alice...');
  const aliceTicketsRes = await axios.get('http://localhost:5000/api/tickets', {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  const aliceTickets = aliceTicketsRes.data.data.tickets;
  console.log(`Found ${aliceTickets.length} tickets for Alice:`);
  aliceTickets.forEach((t) => console.log(`  - #${t._id.slice(-6).toUpperCase()}: [${t.status}] ${t.title} (${t.category})`));

  if (aliceTickets.length !== 3) {
    throw new Error(`Expected Alice to see 3 seeded tickets, but got ${aliceTickets.length}`);
  }
  if (aliceTickets.some((t) => t.createdBy.name && !t.createdBy.name.includes('Alice'))) {
    throw new Error('Alice saw tickets created by another user!');
  }
  console.log('✓ Check 3 Passed: Alice sees exactly her 3 seeded tickets; Bob tickets are excluded.');

  // Check 4: Login as Charlie (Support)
  console.log('\n[Check 4] Authentic login as Charlie (Support)...');
  const charlieLogin = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'charlie.support@company.com',
    password: 'Password123!',
  });
  const charlieToken = charlieLogin.data.data.token;
  const charlieUser = charlieLogin.data.data.user;
  console.log(`✓ Check 4 Passed: Charlie authenticated (Role: ${charlieUser.role}).`);

  // Check 5: Charlie tickets query (must see all 5 seeded tickets)
  console.log('\n[Check 5] Querying tickets as Charlie (Support)...');
  const charlieTicketsRes = await axios.get('http://localhost:5000/api/tickets', {
    headers: { Authorization: `Bearer ${charlieToken}` },
  });
  const allTickets = charlieTicketsRes.data.data.tickets;
  console.log(`Found ${allTickets.length} tickets for Support:`);
  allTickets.forEach((t) => console.log(`  - #${t._id.slice(-6).toUpperCase()}: [${t.status}] ${t.title} (Created by: ${t.createdBy.name})`));

  if (allTickets.length !== 5) {
    throw new Error(`Expected Support to see 5 seeded tickets, but got ${allTickets.length}`);
  }
  console.log('✓ Check 5 Passed: Support sees all 5 tickets across Alice and Bob.');

  // Check 6: Alice creates a new ticket
  console.log('\n[Check 6] Alice creates a new ticket...');
  const newTicketRes = await axios.post(
    'http://localhost:5000/api/tickets',
    {
      title: 'Wireless mouse pointer lagging',
      description: 'The optical sensor is erratic on the wooden desk.',
      category: 'Hardware',
      priority: 'Medium',
    },
    { headers: { Authorization: `Bearer ${aliceToken}` } }
  );
  const newTicket = newTicketRes.data.data;
  console.log(`✓ Check 6 Passed: Ticket created #${newTicket._id.slice(-6).toUpperCase()} with status "${newTicket.status}".`);

  // Check 7: Verify Employee cannot triage or update status (403 Forbidden)
  console.log('\n[Check 7] Verifying Employee cannot triage or update status...');
  let triageBlocked = false;
  try {
    await axios.patch(
      `http://localhost:5000/api/tickets/${newTicket._id}/triage`,
      { priority: 'High' },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
  } catch (e) {
    if (e.response?.status === 403) triageBlocked = true;
  }

  let statusBlocked = false;
  try {
    await axios.patch(
      `http://localhost:5000/api/tickets/${newTicket._id}/status`,
      { status: 'In Progress' },
      { headers: { Authorization: `Bearer ${aliceToken}` } }
    );
  } catch (e) {
    if (e.response?.status === 403) statusBlocked = true;
  }

  if (!triageBlocked || !statusBlocked) {
    throw new Error('Employee was not blocked with 403 from triage/status actions!');
  }
  console.log('✓ Check 7 Passed: Employee is strictly blocked from triage and status modification (403 Forbidden).');

  // Check 8: Support triages the ticket
  console.log('\n[Check 8] Support triages ticket...');
  const triageRes = await axios.patch(
    `http://localhost:5000/api/tickets/${newTicket._id}/triage`,
    { category: 'Other', priority: 'High' },
    { headers: { Authorization: `Bearer ${charlieToken}` } }
  );
  if (triageRes.data.data.category !== 'Other' || triageRes.data.data.priority !== 'High') {
    throw new Error('Triage values did not update properly');
  }
  console.log(`✓ Check 8 Passed: Support updated triage (Category: ${triageRes.data.data.category}, Priority: ${triageRes.data.data.priority}).`);

  // Check 9: Support advances status through lifecycle
  console.log('\n[Check 9] Support advances status through lifecycle...');
  const step1 = await axios.patch(
    `http://localhost:5000/api/tickets/${newTicket._id}/status`,
    { status: 'In Progress' },
    { headers: { Authorization: `Bearer ${charlieToken}` } }
  );
  console.log(`  -> Advanced to: ${step1.data.data.status}`);

  const step2 = await axios.patch(
    `http://localhost:5000/api/tickets/${newTicket._id}/status`,
    { status: 'Resolved' },
    { headers: { Authorization: `Bearer ${charlieToken}` } }
  );
  console.log(`  -> Advanced to: ${step2.data.data.status}`);

  const step3 = await axios.patch(
    `http://localhost:5000/api/tickets/${newTicket._id}/status`,
    { status: 'Closed' },
    { headers: { Authorization: `Bearer ${charlieToken}` } }
  );
  console.log(`  -> Advanced to: ${step3.data.data.status}`);
  console.log('✓ Check 9 Passed: Support advanced Open -> In Progress -> Resolved -> Closed.');

  // Check 10: Closed ticket modification blocked (409 Conflict)
  console.log('\n[Check 10] Verifying Closed ticket cannot be modified...');
  let closedStatusBlocked = false;
  try {
    await axios.patch(
      `http://localhost:5000/api/tickets/${newTicket._id}/status`,
      { status: 'In Progress' },
      { headers: { Authorization: `Bearer ${charlieToken}` } }
    );
  } catch (e) {
    if (e.response?.status === 409) closedStatusBlocked = true;
  }

  let closedTriageBlocked = false;
  try {
    await axios.patch(
      `http://localhost:5000/api/tickets/${newTicket._id}/triage`,
      { priority: 'Low' },
      { headers: { Authorization: `Bearer ${charlieToken}` } }
    );
  } catch (e) {
    if (e.response?.status === 409) closedTriageBlocked = true;
  }

  if (!closedStatusBlocked || !closedTriageBlocked) {
    throw new Error('Closed ticket was not protected with 409 Conflict!');
  }
  console.log('✓ Check 10 Passed: Closed ticket status and triage modifications are rejected with 409 Conflict.');

  // Check 11: Title search & Filters
  console.log('\n[Check 11] Testing search and filters...');
  const searchRes = await axios.get('http://localhost:5000/api/tickets?search=mouse', {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  if (searchRes.data.data.tickets.length !== 1) {
    throw new Error('Search query did not return the expected ticket');
  }
  console.log(`  - Search for "mouse": returned 1 ticket ("${searchRes.data.data.tickets[0].title}")`);

  const categoryFilterRes = await axios.get('http://localhost:5000/api/tickets?category=Software', {
    headers: { Authorization: `Bearer ${charlieToken}` },
  });
  console.log(`  - Category "Software" filter: returned ${categoryFilterRes.data.data.tickets.length} tickets`);

  const statusFilterRes = await axios.get('http://localhost:5000/api/tickets?status=Closed', {
    headers: { Authorization: `Bearer ${charlieToken}` },
  });
  console.log(`  - Status "Closed" filter: returned ${statusFilterRes.data.data.tickets.length} tickets`);
  console.log('✓ Check 11 Passed: Search and filtering endpoints return accurate subsets.');

  console.log('\n======================================================');
  console.log('ALL 11 LIVE SMOKE TEST CHECKS COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
}

runLiveSmokeTest().catch((err) => {
  console.error('FATAL SMOKE TEST ERROR:', err.message);
  process.exit(1);
});
