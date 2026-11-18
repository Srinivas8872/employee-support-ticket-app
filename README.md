# Employee Support Ticket Management System

An educational full-stack prototype demonstrating secure Role-Based Access Control (RBAC), a strict forward-only ticket lifecycle state machine, atomic append-only audit logging, and modern web application development.

Designed specifically for student lab demonstrations and software engineering training.

---

## 1. Technology Stack

- **Frontend:** React 18, Vite 6, Tailwind CSS 3, React Router 7, Lucide Icons, Axios.
- **Backend:** Node.js, Express.js (REST API, JWT Authentication, Custom RBAC Middleware).
- **Database:** MongoDB, Mongoose 8 (Indexes, Multi-collection session transactions).
- **Testing:** Jest, Supertest, `mongodb-memory-server` (Multi-replica set transaction testing).

---

## 2. System Architecture & User Roles

The application enforces strict separation of privileges between two roles:

| Capability | Employee Role | Support Staff Role |
| :--- | :---: | :---: |
| **Authentication & Profile** | Yes (Register & Login) | Yes (Seeded Demo Accounts) |
| **Submit New Support Ticket** | Yes (Initial status: `Open`) | Yes (Initial status: `Open`) |
| **Ticket Visibility Scope** | **Own tickets only** (Strictly scoped) | **Global Queue** (All tickets) |
| **Search & Filter Tickets** | Scoped to own tickets | Global queue filtering |
| **Title & Description Editing** | **Immutable** (Read-only) | **Immutable** (Read-only) |
| **Triage Category & Priority** | No (Forbidden & hidden) | **Yes** (`Open` & `In Progress` only) |
| **Advance Ticket Status** | No (Forbidden & hidden) | **Yes** (Strict forward-only progression) |
| **Append-Only Comments** | Yes (Own tickets only) | **Yes** (All tickets) |
| **Commenting on Closed Tickets** | **Yes** (Follow-ups allowed) | **Yes** (Follow-ups allowed) |
| **Edit / Delete Comments** | **No** (Strictly append-only) | **No** (Strictly append-only) |
| **Activity Timeline Audit Trail** | Yes (Own tickets only) | Yes (All tickets) |

### Strict Ticket Lifecycle State Machine
```text
[Open] ───> [In Progress] ───> [Resolved] ───> [Closed] (Final State)
```
- Only Support Staff can advance the ticket status.
- Linear forward-only transitions (`Open` $\rightarrow$ `In Progress` $\rightarrow$ `Resolved` $\rightarrow$ `Closed`).
- Reopening, backward transitions, and stage-skipping are rejected with `400 Bad Request`.
- Tickets in `Closed` status cannot be modified (status changes and triage reject with `409 Conflict`).

---

## 3. Demonstration Accounts

For demonstration purposes, authentic one-click login buttons are provided on the login page. These buttons authenticate through the normal backend `POST /api/auth/login` endpoint using seeded credentials:

| Role | Account Name | Email Address | Password |
| :--- | :--- | :--- | :--- |
| **Employee** | Alice Employee | `alice@company.com` | `Password123!` |
| **Employee** | Bob Employee | `bob@company.com` | `Password123!` |
| **Support Staff** | Charlie Support | `charlie.support@company.com` | `Password123!` |
| **Support Staff** | Diana Support | `diana.support@company.com` | `Password123!` |

> **Note on Self-Registration:** Any user who signs up through the `/register` page is automatically provisioned as an **Employee**. Self-assignment of the Support role is blocked on both client and backend.

---

## 4. Prerequisites

- **Node.js:** v18.0.0 or higher (v20+ recommended).
- **npm:** v9.0.0 or higher.
- **MongoDB:** A locally running MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas URI.

---

## 5. Environment Configuration

The repository includes safe template files (`.env.example`) that are checked into source control. Actual `.env` files are ignored to prevent credential leakage.

### Backend Configuration (`server/.env`)
Create `server/.env` with:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ticket_app_dev
JWT_SECRET=demo_student_jwt_secret_key_12345
ALLOW_SEED_RESET=true
```

### Frontend Configuration (`client/.env`)
Create `client/.env` with:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 6. Installation & Database Seeding

### Step 1: Install Dependencies
Run from the root directory:
```bash
# Install root, backend, and frontend dependencies
npm run install:all
```
Or install individually:
```bash
cd server && npm install
cd ../client && npm install
```

### Step 2: Seed Development Database
The database seeder drops existing collections and provisions 4 accounts and 5 sample tickets with activity audit history. It includes **3 safety guard layers** (rejects production environment, requires `ALLOW_SEED_RESET=true`, and enforces local/dev database URIs).

From the root directory:
```bash
# On Linux / macOS / Bash:
ALLOW_SEED_RESET=true npm run seed

# On Windows PowerShell:
$env:ALLOW_SEED_RESET="true"; npm run seed
```
Or directly from `server/`:
```bash
cd server
node scripts/seed.js
```

---

## 7. Starting the Application

Run the backend and frontend services in separate terminal windows.

### Terminal 1: Start Backend API (Port 5000)
```bash
# From root:
npm run dev:server

# Or from server directory:
cd server
npm start
# (or npm run dev for nodemon)
```
Backend API will be live at: **`http://localhost:5000`** (Health check: `http://localhost:5000/health`).

### Terminal 2: Start Frontend Application (Port 5173)
```bash
# From root:
npm run dev:client

# Or from client directory:
cd client
npm run dev
```
Frontend Web Application will be live at: **`http://localhost:5173`**.

---

## 8. Verification & Demonstration Walkthrough Script

Follow these steps for an interactive presentation or grading demonstration:

### Walkthrough Scenario A: Employee Experience (Alice)
1. Navigate to `http://localhost:5173/login`.
2. Click **Alice (Employee)** quick-login button.
3. Observe the top Navbar displaying **Alice Employee** and the blue **Employee** badge.
4. On `/tickets`, observe that Alice sees **only her 3 seeded tickets**:
   - `Request a second monitor` (`Closed` &bull; Hardware)
   - `Cannot log in to VPN` (`In Progress` &bull; Network)
   - `Laptop not charging` (`Open` &bull; Hardware)
   *(Bob's 2 tickets are completely hidden).*
5. Click **+ Create Ticket**:
   - Enter Title: `Broken Office Chair Hydraulic`
   - Select Category: `Hardware`, Priority: `Low`
   - Enter Description: `Chair sinks to lowest height unexpectedly.`
   - Click **Create Ticket** &rarr; automatically redirected to `/tickets/:id` with initial status `Open`.
6. On the Ticket Detail page:
   - Notice that Title and Description are read-only.
   - Notice that **no Support triage dropdowns or status buttons are visible** to Alice.
   - Post an append-only comment: `"Issue started after moving to desk 4B."`.
   - Observe the Activity Timeline immediately updates to show the comment bubble.
7. Click **Back to Tickets** and test the title search bar: type `Chair` &rarr; only the chair ticket appears. Click **Reset**.
8. Click **Logout** in the Navbar &rarr; redirected to `/login`.

### Walkthrough Scenario B: Support Staff Experience (Charlie)
1. On `/login`, click **Charlie (Support)** quick-login button.
2. Observe Navbar displaying **Charlie Support** and the purple **Support Staff** badge.
3. On `/tickets`, observe that Charlie sees the **Global Support Queue** containing all tickets across Alice and Bob.
4. Click on Alice's newly created `Broken Office Chair Hydraulic` ticket (`Open`).
5. Notice the **Support Staff Controls** panel is now visible:
   - **Triage Management:** Change Category to `Other` and Priority to `Medium` &rarr; click **Update Triage**.
   - Notice timeline records a `TRIAGED` event.
   - **Lifecycle Progression:** Click **Start Progress** &rarr; ticket updates to `In Progress`.
   - Click **Mark as Resolved** &rarr; ticket updates to `Resolved`.
   - Click **Close Ticket** &rarr; ticket updates to `Closed`.
6. Notice that once `Closed`:
   - Lifecycle Progression shows `"Ticket Closed (Final State): Status cannot be modified or reopened."`
   - Triage Management shows `"Triage Locked: Category and priority cannot be modified when a ticket is in Closed status."`
7. In the Comments section, add a follow-up comment: `"New chair replacement ordered and delivered."`.
   - Observe that **commenting remains fully functional on Closed tickets**.
8. Toggle between **All Activity** and **Comments Only** filter pills in the timeline to view filtered events.

---

## 9. REST API Reference

All requests and responses use JSON. Authenticated endpoints require `Authorization: Bearer <token>`.

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user (forces `Employee` role, password $\ge 8$ chars). |
| `POST` | `/api/auth/login` | Public | Authenticate with email & password, returns JWT (24h) and user info. |
| `GET` | `/api/auth/me` | Private | Retrieve active profile from Bearer token (session verification). |

### Ticket Endpoints (`/api/tickets`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets` | Private (All) | Create support ticket (`Open` initial status). |
| `GET` | `/api/tickets` | Private (All) | List tickets. Scoped to own tickets for Employees; all tickets for Support. Filters: `search`, `status`, `category`. |
| `GET` | `/api/tickets/:id` | Private (Owner/Support) | Retrieve single ticket details. Returns `403` if Employee attempts cross-tenant access. |
| `PATCH` | `/api/tickets/:id/triage` | Support Staff | Update `category` and `priority`. Allowed only on `Open` and `In Progress` (`409` if Closed/Resolved). |
| `PATCH` | `/api/tickets/:id/status` | Support Staff | Advance status forward (`Open` $\rightarrow$ `In Progress` $\rightarrow$ `Resolved` $\rightarrow$ `Closed`). |

### Comments & Timeline Endpoints (`/api/tickets/:id`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets/:id/comments` | Private (Owner/Support) | Append-only comment. Permitted on all statuses including `Closed`. Atomic audit logging. |
| `GET` | `/api/tickets/:id/timeline` | Private (Owner/Support) | Returns unified chronological audit trail (creation, triage, status changes, and comments). |

---

## 10. Automated Test Suites

### Run Backend Integration Tests
Execute from the root directory:
```bash
npm run test:server
```
Or from the `server/` directory:
```bash
cd server
npm test
```
Runs **8 test suites (77 total automated integration tests)** covering:
- `tests/auth.test.js`: Registration, password hashing, Support role self-assignment guard, login, JWT validation, `/api/auth/me`.
- `tests/models.test.js`: Schema validation, defaults, unique email index, field constraints.
- `tests/seed-safety.test.js`: Production abort guard, confirmation flag guard, local URI validation.
- `tests/ticket-permissions.test.js`: Role scoping, cross-employee access rejection (403), search isolation.
- `tests/status-transitions.test.js`: Forward-only progression, skipping/backward rejection (400), closed ticket protection (409).
- `tests/triage.test.js`: Support triage on active tickets, rejection on resolved/closed tickets (409), employee triage block (403).
- `tests/comments-activity.test.js`: Session transactions, atomicity, append-only immutability, Closed ticket commenting, chronological timeline.
- `tests/health.test.js`: Server health probe.

### Run Frontend Production Build Check
```bash
cd client
npm run build
```
Compiles and bundles the complete React single-page application into `client/dist/`.

---

## 11. Security & Educational Trade-Offs Notice

- **JWT Storage:** Tokens are persisted in browser `localStorage` to allow direct developer inspection and ease of demonstration. In a production enterprise system, `HttpOnly` `SameSite=Strict` cookies paired with refresh token rotation would be preferred to mitigate XSS exposure.
- **Seeder Safety:** Seeding operations strictly verify `NODE_ENV !== 'production'` and require an explicit `ALLOW_SEED_RESET=true` flag.
