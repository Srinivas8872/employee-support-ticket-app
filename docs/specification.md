# Technical Specification: Employee Support Ticket Management System

**Document Version:** 1.2.0  
**Status:** Approved Specification  
**Date:** 2026-11-18  
**Scope:** Educational Full-Stack Training Prototype  

---

## 1. System Overview & Scope

The **Employee Support Ticket Management System** is a role-based, full-stack web application designed for internal enterprise support workflows. It enables employees to log technical issues and track their progress, while support staff manage, triage, and resolve incoming tickets through a standardized lifecycle.

The system is built as a maintainable, clean prototype with zero extraneous dependencies, utilizing fictional sample data and strict server-enforced business rules.

---

## 2. Requirements Catalog

### 2.1 Functional Requirements (FR)

#### Authentication & User Management
- **FR-AUTH-01:** The system shall support public user registration, assigning exclusively the `Employee` role.
- **FR-AUTH-02:** The system shall strictly reject or ignore any client attempt to self-assign the `Support` role during registration.
- **FR-AUTH-03:** The system shall authenticate users via email and password, returning a signed JSON Web Token (JWT) valid for 24 hours.
- **FR-AUTH-04:** The system shall secure passwords using `bcrypt` salted hashing prior to database persistence, enforcing a minimum password length of 8 characters.
- **FR-AUTH-05:** The system shall provide an endpoint (`GET /api/auth/me`) returning the authenticated user's profile and assigned role without exposing credentials.

#### Ticket Management
- **FR-TCK-01:** Any authenticated user with either the `Employee` or `Support` role shall be able to create a ticket with `title`, `description`, `category`, and `priority`.
- **FR-TCK-02:** A newly created ticket shall automatically have its `status` initialized to `Open`, `createdBy` set to the authenticated user ID, and `createdAt`/`updatedAt` timestamps populated.
- **FR-TCK-03:** Employees shall only be permitted to view and query tickets created by their own user ID.
- **FR-TCK-04:** Support Staff shall be permitted to view and query all tickets submitted across the organization.
- **FR-TCK-05:** Ticket `title` and `description` shall be strictly immutable once created. No general ticket-edit API (`PUT /api/tickets/:id` or generic `PATCH`) shall exist in version 1.
- **FR-TCK-06:** Support Staff shall be permitted to update ticket `category` and `priority` exclusively via the dedicated triage endpoint (`PATCH /api/tickets/:id/triage`), and only while the ticket is in `Open` or `In Progress` status. Employees are strictly prohibited from modifying triage fields.
- **FR-TCK-07:** No ticket fields (except comments) shall be editable once the ticket status is `Closed`. Any modification attempt on a closed ticket shall return a resource state conflict (`409 Conflict`).
- **FR-TCK-08:** Valid modifications to a ticket (status change or triage update) shall automatically update the ticket's `updatedAt` timestamp.

#### Status Lifecycle & State Machine
- **FR-STS-01:** Only Support Staff shall be permitted to update ticket status.
- **FR-STS-02:** Ticket status transitions shall strictly enforce the forward-only progression:  
  $$\text{Open} \longrightarrow \text{In Progress} \longrightarrow \text{Resolved} \longrightarrow \text{Closed}$$
- **FR-STS-03:** The system shall reject backward transitions, status skipping, and reopening in version 1.
- **FR-STS-04:** Attempting to alter the status of a `Closed` ticket shall return a resource state conflict (`409 Conflict`).

#### Comments & Activity Timeline
- **FR-CMT-01:** Employees shall be permitted to post comments exclusively to tickets they own.
- **FR-CMT-02:** Support Staff shall be permitted to post comments to any ticket.
- **FR-CMT-03:** Comments shall be allowed on tickets in any status, including `Closed`.
- **FR-CMT-04:** Comments shall be strictly append-only and immutable; no user (regardless of role) may edit or delete existing comments.
- **FR-CMT-05:** When a comment is submitted, it shall be persisted once in the `comments` collection, and a corresponding `TicketActivity` event (`COMMENTED`) shall be recorded. Operations shall execute within a MongoDB session/transaction when connected to a replica set (including automated tests running on `MongoMemoryReplSet`), ensuring atomic consistency.
- **FR-ACT-01:** The system shall automatically record an audit activity entry whenever a ticket is created (`CREATED`), its status changes (`STATUS_CHANGED`), triage details are updated (`TRIAGED`), or a comment is posted (`COMMENTED`).
- **FR-ACT-02:** The system shall expose a unified chronological timeline combining status changes, triage events, and comments for any ticket accessible to the requesting user.

#### Search & Filtering
- **FR-SRCH-01:** The system shall allow users to filter tickets by `status` and `category`.
- **FR-SRCH-02:** The system shall allow users to search tickets by case-insensitive matching on `title`.
- **FR-SRCH-03:** All search and filter queries executed by Employees must be strictly scoped to their own tickets (`createdBy === req.user.id`).

#### Database Seeding
- **FR-SEED-01:** The system shall provide an automated seed script (`npm run seed`) creating 2 pre-configured Employee accounts, 2 Support Staff accounts, and the 5 standard sample tickets.
- **FR-SEED-02:** The seed script must enforce multi-layer environment safety: it shall abort immediately if `NODE_ENV === 'production'`, require an explicit confirmation flag (`ALLOW_SEED_RESET=true`), and verify that the target database URI corresponds to a local or dedicated development/test database before dropping collections.

---

### 2.2 Non-Functional Requirements (NFR)

- **NFR-SEC-01 (Authorization Enforcement):** All role permissions and ownership constraints must be enforced on the backend via Express middleware.
- **NFR-SEC-02 (Credential Confidentiality):** Passwords, JWT secrets, and database connection strings must never be committed to source control or exposed in API responses.
- **NFR-SEC-03 (Input Validation):** All incoming request payloads must be validated at the boundary before controller execution.
- **NFR-SEC-04 (Token Storage Architecture & Notice):** For this educational prototype, client JWT storage shall use browser `localStorage` for simplicity. The documentation explicitly notes the associated security trade-off (vulnerability to Cross-Site Scripting / XSS) and documents production-grade alternatives (`HttpOnly`, `Secure`, `SameSite=Strict` cookies with CSRF protection and refresh token rotation).
- **NFR-REL-01 (Error & Conflict Handling):** The API shall clearly distinguish between malformed requests (`400 Bad Request`), authentication failures (`401 Unauthorized`), permission violations (`403 Forbidden`), missing entities (`404 Not Found`), and resource state conflicts (`409 Conflict`).
- **NFR-TST-01 (Automated Test Coverage):** Core business rules (RBAC permissions, state machine transitions, comment ownership, triage immutability) must be validated with automated integration tests using Jest, Supertest, and `MongoMemoryReplSet`.
- **NFR-MOD-01 (Code Maintainability):** The codebase must follow standard separation of concerns: routes, controllers, middleware, models, and utility services.

---

## 3. User Roles & Permissions Matrix

| Operation / Capability | Employee | Support Staff | Unauthenticated |
| :--- | :---: | :---: | :---: |
| Register Account (Employee Role) | Allowed | N/A (Seeded) | Allowed |
| Register Account (Support Staff Role) | **Forbidden (403)** | **Forbidden (403)** | **Forbidden (403)** |
| Login / Refresh Token | Allowed | Allowed | Allowed |
| View Own Tickets | Allowed | Allowed | Forbidden (401) |
| View Other Employees' Tickets | **Forbidden (403)** | Allowed | Forbidden (401) |
| Create Ticket | Allowed | Allowed | Forbidden (401) |
| General Ticket Edit (`PUT` / `PATCH` on title/desc) | **Endpoint Does Not Exist** | **Endpoint Does Not Exist** | **Endpoint Does Not Exist** |
| Update Category/Priority (`Open` / `In Progress`) | **Forbidden (403)** | Allowed | Forbidden (401) |
| Update Category/Priority (`Resolved` / `Closed`) | **Forbidden (403)** | **State Conflict (409)** | Forbidden (401) |
| Transition Ticket Status | **Forbidden (403)** | Allowed (Forward-only) | Forbidden (401) |
| Transition Status on `Closed` Ticket | **Forbidden (403)** | **State Conflict (409)** | Forbidden (401) |
| Add Comment (Own Ticket) | Allowed | Allowed | Forbidden (401) |
| Add Comment (Other Employee's Ticket) | **Forbidden (403)** | Allowed | Forbidden (401) |
| Add Comment on `Closed` Ticket | Allowed (Own) | Allowed | Forbidden (401) |
| Edit or Delete Comments | **Endpoint Does Not Exist** | **Endpoint Does Not Exist** | **Endpoint Does Not Exist** |

---

## 4. MongoDB Database Schemas (Mongoose)

### 4.1 `User` Schema
Collection: `users`

```typescript
interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'Employee' | 'Support';
  createdAt: Date;
  updatedAt: Date;
}
```

```javascript
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['Employee', 'Support'],
        message: '{VALUE} is not a valid role',
      },
      default: 'Employee',
      required: true,
    },
  },
  { timestamps: true }
);
```

### 4.2 `Ticket` Schema
Collection: `tickets`

```typescript
interface ITicket {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category: 'Hardware' | 'Software' | 'Network' | 'Access' | 'Other';
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

```javascript
const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: {
        values: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        message: '{VALUE} is not a supported category',
      },
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'Medium',
      required: [true, 'Priority is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['Open', 'In Progress', 'Resolved', 'Closed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Open',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ title: 'text' });
```

### 4.3 `Comment` Schema
Collection: `comments`

```typescript
interface IComment {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  createdAt: Date;
}
```

```javascript
const commentSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content cannot be empty'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

### 4.4 `TicketActivity` Schema
Collection: `ticketactivities`

```typescript
interface ITicketActivity {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  performedBy: Types.ObjectId;
  activityType: 'CREATED' | 'STATUS_CHANGED' | 'TRIAGED' | 'COMMENTED';
  details: {
    previousValue?: string;
    newValue?: string;
    message: string;
  };
  createdAt: Date;
}
```

```javascript
const ticketActivitySchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityType: {
      type: String,
      enum: ['CREATED', 'STATUS_CHANGED', 'TRIAGED', 'COMMENTED'],
      required: true,
    },
    details: {
      previousValue: { type: String },
      newValue: { type: String },
      message: { type: String, required: true },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

---

## 5. REST API Contract

All endpoints use JSON payloads and return a consistent response envelope:
```json
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Optional contextual message"
}

// Error Response
{
  "success": false,
  "message": "Human-readable error summary",
  "errors": [ "Specific validation detail" ]
}
```

### 5.1 Authentication Endpoints

#### `POST /api/auth/register`
- **Description:** Public registration for employees. Strips any incoming `role` and forces `Employee`.
- **Access:** Public.
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123"
  }
  ```
- **Responses:**
  - `201 Created`: User created and JWT returned.
  - `400 Bad Request`: Validation failure (password < 8 chars, invalid email format, missing fields).
  - `409 Conflict`: Email already exists.

#### `POST /api/auth/login`
- **Description:** Authenticate user and issue JWT.
- **Access:** Public.
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "Password123"
  }
  ```
- **Responses:**
  - `200 OK`: Returns JWT token and user profile.
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid email or incorrect password.

#### `GET /api/auth/me`
- **Description:** Get active authenticated user profile without password.
- **Access:** Authenticated (`Authorization: Bearer <token>`).
- **Responses:**
  - `200 OK`: Returns current user info.
  - `401 Unauthorized`: Missing, invalid, or expired token.

---

### 5.2 Ticket Endpoints

#### `GET /api/tickets`
- **Description:** List tickets. Scoped to creator for Employees; global for Support Staff.
- **Access:** Authenticated (`Employee` or `Support`).
- **Query Parameters:**
  - `search` (string, optional): Case-insensitive match against title.
  - `status` (`Open` | `In Progress` | `Resolved` | `Closed`, optional).
  - `category` (`Hardware` | `Software` | `Network` | `Access` | `Other`, optional).
- **Responses:**
  - `200 OK`: Returns matching tickets list and total count.
  - `401 Unauthorized`: Missing or invalid token.

#### `POST /api/tickets`
- **Description:** Submit a new ticket.
- **Access:** Authenticated (`Employee` or `Support`).
- **Request Body:**
  ```json
  {
    "title": "Cannot log in to VPN",
    "description": "Getting authentication timeout error 403 on client v4.2",
    "category": "Network",
    "priority": "High"
  }
  ```
- **Responses:**
  - `201 Created`: Returns created ticket document with initial status `Open`.
  - `400 Bad Request`: Validation failure (title > 100 chars, empty fields, invalid enum).
  - `401 Unauthorized`: Missing or invalid token.

#### `GET /api/tickets/:id`
- **Description:** Retrieve full ticket details including creator info.
- **Access:** Authenticated (Creator Employee or any Support Staff).
- **Responses:**
  - `200 OK`: Returns ticket document.
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Employee attempting to view another user's ticket.
  - `404 Not Found`: Ticket ID does not exist.

#### `PATCH /api/tickets/:id/status`
- **Description:** Advance the ticket status according to the strict state machine.
- **Access:** Support Staff only (`requireRole('Support')`).
- **Request Body:**
  ```json
  {
    "status": "In Progress"
  }
  ```
- **Responses:**
  - `200 OK`: Status updated, activity recorded, returns updated ticket with fresh `updatedAt`.
  - `400 Bad Request`: Invalid transition within active statuses (e.g. `Open` $\rightarrow$ `Resolved`, backward, identical, or invalid value).
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Authenticated user is an Employee.
  - `404 Not Found`: Ticket does not exist.
  - `409 Conflict`: Ticket is in `Closed` status and cannot be modified.

#### `PATCH /api/tickets/:id/triage`
- **Description:** Update ticket category and/or priority. Allowed only while status is `Open` or `In Progress`.
- **Access:** Support Staff only (`requireRole('Support')`).
- **Request Body:**
  ```json
  {
    "category": "Software",
    "priority": "Medium"
  }
  ```
- **Responses:**
  - `200 OK`: Triage updated, activity recorded, returns updated ticket with fresh `updatedAt`.
  - `400 Bad Request`: Invalid category or priority enum value, or empty payload.
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Authenticated user is an Employee.
  - `404 Not Found`: Ticket does not exist.
  - `409 Conflict`: Ticket is in `Resolved` or `Closed` status (state conflict preventing triage).

---

### 5.3 Comments & Activity Timeline Endpoints

#### `POST /api/tickets/:id/comments`
- **Description:** Add a new comment to a ticket. Permitted on tickets in any status, including `Closed`.
- **Access:** Ticket Creator (Employee) or any Support Staff.
- **Request Body:**
  ```json
  {
    "content": "Please verify if the AC adapter light turns blue when plugged in."
  }
  ```
- **Responses:**
  - `201 Created`: Comment appended to `comments` collection, `TicketActivity` recorded atomically, returns created comment.
  - `400 Bad Request`: Empty content or content exceeds 1000 characters.
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Employee attempting to comment on another user's ticket.
  - `404 Not Found`: Ticket does not exist.

#### `GET /api/tickets/:id/timeline`
- **Description:** Retrieve the unified chronological timeline (status transitions, triage events, and comments combined) for the ticket.
- **Access:** Ticket Creator (Employee) or any Support Staff.
- **Responses:**
  - `200 OK`: Returns chronological array of activities and comments.
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden`: Employee requesting timeline of someone else's ticket.
  - `404 Not Found`: Ticket does not exist.

---

## 6. Authentication & Authorization Design

### 6.1 Authentication Flow
1. User provides email and password.
2. Server verifies password via `bcrypt.compare(plaintext, user.password)`.
3. Server generates JWT signed with `JWT_SECRET`:
   ```javascript
   const payload = {
     userId: user._id,
     role: user.role
   };
   const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
   ```
4. Client stores the token in browser `localStorage`.
5. Axios/Fetch interceptor attaches the token to subsequent HTTP requests:  
   `Authorization: Bearer <token>`.

### 6.2 Token Storage Architecture & Security Notice
- **Prototype Implementation:** For this educational project, tokens are stored in browser `localStorage` for simple inspection and debugging in developer tools.
- **Security Trade-Off (XSS Vulnerability):** Tokens stored in `localStorage` are accessible by any script running within the same origin. An application vulnerability to Cross-Site Scripting (XSS) could expose the token.
- **Production Alternatives:**
  1. **HttpOnly, Secure Cookies:** Store JWTs in cookies flagged with `HttpOnly` (inaccessible to JavaScript), `Secure` (transmitted only over HTTPS), and `SameSite=Strict` or `SameSite=Lax` (mitigating CSRF).
  2. **Token Rotation & Short-Lived Access Tokens:** Use 15-minute access tokens kept in application memory paired with HttpOnly refresh tokens for session renewal.
  3. **Content Security Policy (CSP):** Enforce strict CSP headers to mitigate script injection vectors.

### 6.3 Middleware Architecture

```
[ Incoming Request ]
         │
         ▼
[ requireAuth Middleware ]
  - Extracts Bearer token from Authorization header
  - Verifies signature and expiration
  - Attaches decoded user { id, role } to req.user
         │
         ├─── Valid? ──► No ──► HTTP 401 Unauthorized
         ▼ Yes
[ requireRole(['Support']) Middleware ] (For Support-only endpoints)
  - Checks if req.user.role === 'Support'
         │
         ├─── Allowed? ─► No ──► HTTP 403 Forbidden
         ▼ Yes
[ canAccessTicket Middleware ] (For Ticket Detail / Comments / Timeline)
  - Fetches ticket from DB
  - If req.user.role === 'Support' -> Next()
  - If req.user.role === 'Employee' && ticket.createdBy.equals(req.user.id) -> Next()
  - Otherwise -> HTTP 403 Forbidden
         │
         ▼
[ Controller Execution ]
```

---

## 7. Ticket Status State Machine

### 7.1 State Transition Matrix

Ticket status transitions enforce a strict, forward-only finite state machine:

$$\text{Open} \longrightarrow \text{In Progress} \longrightarrow \text{Resolved} \longrightarrow \text{Closed}$$

| Current Status | Target: `Open` | Target: `In Progress` | Target: `Resolved` | Target: `Closed` |
| :--- | :---: | :---: | :---: | :---: |
| **`Open`** | ❌ 400 (Identical) | ✅ **Allowed** | ❌ 400 (Skipping) | ❌ 400 (Skipping) |
| **`In Progress`**| ❌ 400 (Backward) | ❌ 400 (Identical) | ✅ **Allowed** | ❌ 400 (Skipping) |
| **`Resolved`** | ❌ 400 (Backward) | ❌ 400 (Reopening) | ❌ 400 (Identical) | ✅ **Allowed** |
| **`Closed`** | ❌ 409 (Conflict: Closed)| ❌ 409 (Conflict: Closed)| ❌ 409 (Conflict: Closed)| ❌ 409 (Conflict: Closed)|

### 7.2 State Machine Implementation
```javascript
const VALID_TRANSITIONS = {
  'Open': ['In Progress'],
  'In Progress': ['Resolved'],
  'Resolved': ['Closed'],
  'Closed': []
};

function checkStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === 'Closed') {
    return { valid: false, code: 409, message: 'Closed tickets cannot change status.' };
  }
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      code: 400,
      message: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Progression must follow Open -> In Progress -> Resolved -> Closed.`
    };
  }
  return { valid: true };
}
```

---

## 8. Validation & Error Handling

### 8.1 Input Constraints

| Field | Location | Validation Rule | Error Message |
| :--- | :--- | :--- | :--- |
| `name` | Register | Required, 2–50 characters | `Name must be between 2 and 50 characters` |
| `email` | Register / Login | Required, valid email format | `Please provide a valid email address` |
| `password` | Register | Required, minimum 8 characters | `Password must be at least 8 characters` |
| `title` | Create Ticket | Required, max 100 characters, non-empty | `Title is required and must not exceed 100 characters` |
| `description`| Create Ticket | Required, non-empty | `Description cannot be empty` |
| `category` | Create / Triage | Enum: `Hardware`, `Software`, `Network`, `Access`, `Other` | `Invalid category provided` |
| `priority` | Create / Triage | Enum: `Low`, `Medium`, `High` | `Invalid priority provided` |
| `status` | Update Status | Enum: `Open`, `In Progress`, `Resolved`, `Closed` | `Invalid ticket status provided` |
| `content` | Add Comment | Required, 1–1000 characters | `Comment cannot be empty or exceed 1000 characters` |

### 8.2 Standard HTTP Status Code Mapping
- **`400 Bad Request`**: Malformed payload, failed input validation constraints, or invalid status transition attempt within active ticket statuses.
- **`401 Unauthorized`**: Authentication missing, malformed token, invalid credentials, or expired session.
- **`403 Forbidden`**: Authenticated user lacks permission for the action (e.g. Employee attempting triage, modifying another user's ticket, or assigning Support role).
- **`404 Not Found`**: Target resource (Ticket, Comment, User) does not exist in the database.
- **`409 Conflict`**: Resource state conflict, specifically:
  - Attempting to update triage (`category`/`priority`) on `Resolved` or `Closed` tickets.
  - Attempting to transition status on a `Closed` ticket.
  - Registering with an email that already exists.
- **`500 Internal Server Error`**: Unhandled server exception (safely logged, returning a generic safe error to the client).

---

## 9. Acceptance Criteria (Given–When–Then)

### User Registration & Security
- **AC-01 (Public Registration Role Guard - FR-AUTH-01):**
  - **Given** an unauthenticated visitor registering via `POST /api/auth/register`,
  - **When** the payload specifies `role: "Support"`,
  - **Then** the user account is created with `role: "Employee"`, and the response returns role `Employee`.

- **AC-02 (Password Minimum Length Enforcement - FR-AUTH-04):**
  - **Given** a registration request with a 7-character password (`"Pass123"`),
  - **When** submitted to `POST /api/auth/register`,
  - **Then** the server responds with `400 Bad Request` and message `"Password must be at least 8 characters"`.

- **AC-03 (Password Hash Confidentiality - FR-AUTH-04):**
  - **Given** a user registered with password `"Password123!"`,
  - **When** inspected in MongoDB or returned via `GET /api/auth/me`,
  - **Then** the password field in the database is a `$2b$` bcrypt hash and the API response completely omits the password field.

### Ticket Creation by Both Roles
- **AC-04 (Employee Creates Ticket - FR-TCK-01):**
  - **Given** an authenticated user with role `Employee`,
  - **When** they submit a valid payload to `POST /api/tickets`,
  - **Then** the ticket is created with status `Open`, `createdBy` matching their user ID, and returns `201 Created`.

- **AC-05 (Support Staff Creates Ticket - FR-TCK-01):**
  - **Given** an authenticated user with role `Support`,
  - **When** they submit a valid payload to `POST /api/tickets`,
  - **Then** the ticket is created with status `Open`, `createdBy` matching the Support user's ID, and returns `201 Created`.

### Role-Based Ticket Visibility & Isolation
- **AC-06 (Employee Ticket Isolation - FR-TCK-03):**
  - **Given** an authenticated Employee `emp_1` and a ticket created by Employee `emp_2`,
  - **When** `emp_1` requests `GET /api/tickets/:emp2_ticket_id`,
  - **Then** the server responds with status `403 Forbidden`.

- **AC-07 (Support Global Visibility - FR-TCK-04):**
  - **Given** an authenticated Support Staff user,
  - **When** they request `GET /api/tickets`,
  - **Then** the server responds with status `200 OK` and returns all tickets across all employees.

### Ticket Triage & Immutability
- **AC-08 (Support Staff Triaging Open & In Progress Tickets - FR-TCK-06):**
  - **Given** an authenticated Support Staff user and a ticket in `Open` or `In Progress` status,
  - **When** the user sends `PATCH /api/tickets/:id/triage` with `category: "Hardware"` and `priority: "High"`,
  - **Then** the ticket category and priority are updated, a `TRIAGED` activity is logged, and the server returns `200 OK`.

- **AC-09 (Preventing Triage of Resolved and Closed Tickets - FR-TCK-06, FR-TCK-07):**
  - **Given** an authenticated Support Staff user and a ticket in `Resolved` or `Closed` status,
  - **When** the user sends `PATCH /api/tickets/:id/triage` with new category or priority values,
  - **Then** the server rejects the request with status `409 Conflict` and an error message indicating that resolved and closed tickets cannot be triaged.

- **AC-10 (Employee Denied Triage Capabilities - FR-TCK-06):**
  - **Given** an authenticated Employee (even if they created the ticket),
  - **When** they attempt `PATCH /api/tickets/:id/triage`,
  - **Then** the server responds with `403 Forbidden`.

- **AC-11 (Timestamp Updates on Valid Modifications - FR-TCK-08):**
  - **Given** an existing ticket with timestamp $T_1$,
  - **When** a valid status transition or triage update is performed at a later time $T_2$,
  - **Then** the ticket document's `updatedAt` field is updated such that `updatedAt` $\ge T_2 > T_1$.

### Ticket Status Progression
- **AC-12 (Status Change Authorization - FR-STS-01):**
  - **Given** an authenticated Employee,
  - **When** they send `PATCH /api/tickets/:id/status`,
  - **Then** the server responds with status `403 Forbidden`.

- **AC-13 (Strict Forward Progression - FR-STS-02):**
  - **Given** a ticket in `Open` status and an authenticated Support Staff user,
  - **When** the user sends `PATCH /api/tickets/:id/status` with `status: "In Progress"`,
  - **Then** the status is updated to `In Progress` with response `200 OK`.

- **AC-14 (Disallow Skipping and Backward Transitions - FR-STS-03):**
  - **Given** a ticket in `Open` status and an authenticated Support Staff user,
  - **When** the user sends `PATCH /api/tickets/:id/status` with `status: "Resolved"`,
  - **Then** the server rejects the request with `400 Bad Request` and message indicating invalid status transition.

- **AC-15 (Disallow Changing Closed Ticket Status - FR-STS-04):**
  - **Given** a ticket in `Closed` status,
  - **When** Support Staff sends `PATCH /api/tickets/:id/status` with `status: "Open"`,
  - **Then** the server rejects the request with `409 Conflict` and message `"Closed tickets cannot change status."`.

### Comments & Activity Timeline
- **AC-16 (Comments Allowed on Closed Tickets - FR-CMT-03):**
  - **Given** a ticket in `Closed` status,
  - **When** the ticket creator (Employee) sends `POST /api/tickets/:id/comments` with valid content,
  - **Then** the comment is successfully created with response `201 Created`.

- **AC-17 (Append-Only Comments / No Mutation Endpoints - FR-CMT-04):**
  - **Given** an existing comment ID,
  - **When** any user attempts a `PUT`, `PATCH`, or `DELETE` on `/api/comments/:id` or `/api/tickets/:id/comments/:commentId`,
  - **Then** the server responds with `404 Not Found` (confirming no route exists for comment mutation).

- **AC-18 (Single Comment Persistence and Atomic Activity Logging - FR-CMT-05, FR-ACT-01):**
  - **Given** a valid comment submission on a ticket,
  - **When** processed by the backend,
  - **Then** exactly one document is added to the `comments` collection, exactly one `COMMENTED` document is added to `ticketactivities`, and both appear chronologically on `GET /api/tickets/:id/timeline`.

### Search & Filtering Ownership
- **AC-19 (Employee Search Scoped to Own Tickets - FR-SRCH-03):**
  - **Given** Employee `emp_1` with ticket titled `"VPN issues"` and Employee `emp_2` with ticket titled `"VPN setup"`,
  - **When** `emp_1` requests `GET /api/tickets?search=VPN`,
  - **Then** the response array contains only `"VPN issues"` and excludes `emp_2`'s ticket.

- **AC-20 (Support Search Global Scope - FR-SRCH-01, FR-SRCH-02):**
  - **Given** tickets across multiple employees matching category `"Hardware"`,
  - **When** Support Staff requests `GET /api/tickets?category=Hardware`,
  - **Then** the response array contains all matching tickets across all employees.

---

## 10. Sample Data & Seeding Specification

The seeding script (`server/scripts/seed.js`) resets the configured development or test database by dropping existing collections and populating fresh records matching the approved training data.

### 10.1 Multi-Layer Seed Safety Guard
The seed script enforces three mandatory safety validation layers before executing any destructive operations:
```javascript
// Layer 1: Strictly reject production environment
if (process.env.NODE_ENV === 'production') {
  console.error('CRITICAL ABORT: Database seeding is forbidden in production environments.');
  process.exit(1);
}

// Layer 2: Require explicit confirmation flag
if (process.env.ALLOW_SEED_RESET !== 'true') {
  console.error('CRITICAL ABORT: Seeding drops database collections. Set ALLOW_SEED_RESET=true to confirm.');
  process.exit(1);
}

// Layer 3: Validate that the connection target is local or an explicit dev/test database
const dbUri = process.env.MONGODB_URI || '';
const isLocalOrDevTest = dbUri.includes('localhost') || 
                         dbUri.includes('127.0.0.1') || 
                         dbUri.includes('_dev') || 
                         dbUri.includes('_test');
if (!isLocalOrDevTest) {
  console.error('CRITICAL ABORT: Database target must be a local or explicit development/test database.');
  process.exit(1);
}
```

### 10.2 Users
| Name | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| Alice Employee | `alice@company.com` | `Password123!` | `Employee` |
| Bob Employee | `bob@company.com` | `Password123!` | `Employee` |
| Charlie Support | `charlie.support@company.com` | `Password123!` | `Support` |
| Diana Support | `diana.support@company.com` | `Password123!` | `Support` |

### 10.3 Sample Tickets
| # | Title | Category | Priority | Status | Created By | Description |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Laptop not charging | Hardware | High | Open | Alice | Dell XPS power port is loose and fails to charge when plugged in. |
| 2 | Cannot log in to VPN | Network | High | In Progress | Alice | Cisco AnyConnect returns handshake timeout after password entry. |
| 3 | Need access to the shared project folder | Access | Medium | Open | Bob | Need read/write access to the Q4 Financials network drive. |
| 4 | Excel keeps crashing on startup | Software | Medium | Resolved | Bob | Microsoft Excel 365 crashes immediately with error code 0xC0000005. |
| 5 | Request a second monitor | Hardware | Low | Closed | Alice | Requesting an auxiliary 27-inch monitor for development workspace. |

---

## 11. Testing Requirements

### 11.1 Test Environment & Replica Set Setup
To test atomic transactions between comments and activity logs without requiring an external database, the integration test suite uses `MongoMemoryReplSet` from `mongodb-memory-server`:
```javascript
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;
beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
```

### 11.2 Test Suite Breakdown (Jest + Supertest)

1. **`auth.test.js`**
   - User registration (guarantees default role is `Employee`).
   - Rejecting role self-elevation during registration (assigns `Employee` even if `Support` passed).
   - Password minimum length enforcement (< 8 chars rejected with 400).
   - Successful login and JWT issuance.
   - Failed login on incorrect credentials (401).
   - Profile verification (`/api/auth/me`).

2. **`ticket-permissions.test.js`**
   - Both Employee and Support roles can create tickets (201).
   - Employee can view own tickets.
   - Employee *cannot* view other employee tickets (403).
   - Support Staff can view all tickets across all employees.
   - Search and filtering for Employees returns only their own tickets.
   - Verification that no general ticket-edit route exists.

3. **`triage.test.js`**
   - Support Staff can update category and priority on `Open` and `In Progress` tickets (200).
   - Employee cannot update category or priority (403).
   - Support Staff cannot triage `Resolved` or `Closed` tickets (409 Conflict).
   - Valid triage update refreshes `updatedAt` timestamp.

4. **`status-transitions.test.js`**
   - Employee cannot update status (403).
   - Support Staff can advance `Open` $\rightarrow$ `In Progress` $\rightarrow$ `Resolved` $\rightarrow$ `Closed` (200).
   - Rejection of invalid jump (`Open` $\rightarrow$ `Resolved` returns 400).
   - Rejection of backward transition (`Resolved` $\rightarrow$ `In Progress` returns 400).
   - Rejection of any transition on `Closed` ticket (409 Conflict).
   - Valid status update refreshes `updatedAt` timestamp.

5. **`comments-activity.test.js`**
   - Employee can add comment to own ticket.
   - Employee cannot add comment to another user's ticket (403).
   - Support Staff can add comment to any ticket.
   - Comments allowed on `Closed` ticket (201).
   - Single comment stored in `comments` with corresponding `TicketActivity` created atomically via replica set session.
   - Immutability check: verify no comment edit/delete routes exist.
   - Timeline returns unified chronological sequence of activities and comments.

---

## 12. Project Directory Structure

```
employee-support-ticket-app/
├── docs/
│   └── specification.md           # This specification document
├── client/                        # Frontend (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── api/                   # Axios client and API service functions
│   │   ├── assets/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── Navbar.jsx
│   │   │   ├── StatusBadge.jsx    # Color-coded status pills
│   │   │   ├── PriorityBadge.jsx  # Color-coded priority badges
│   │   │   ├── TicketCard.jsx
│   │   │   ├── TicketFilter.jsx   # Status, category, and search bar
│   │   │   ├── ActivityTimeline.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # User session and JWT in localStorage
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── TicketListPage.jsx
│   │   │   ├── TicketDetailPage.jsx
│   │   │   └── CreateTicketPage.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                        # Backend (Node.js + Express)
│   ├── config/
│   │   └── db.js                  # Mongoose connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── ticketController.js
│   │   └── commentController.js
│   ├── middleware/
│   │   ├── authMiddleware.js      # JWT verification
│   │   ├── roleMiddleware.js      # Role-based access control
│   │   ├── ticketAccessMiddleware.js # Ownership checking
│   │   └── errorMiddleware.js     # Centralized error handler
│   ├── models/
│   │   ├── User.js
│   │   ├── Ticket.js
│   │   ├── Comment.js
│   │   └── TicketActivity.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── ticketRoutes.js
│   ├── scripts/
│   │   └── seed.js                # Database seeder with multi-layer safety check
│   ├── tests/
│   │   ├── auth.test.js
│   │   ├── ticket-permissions.test.js
│   │   ├── triage.test.js
│   │   ├── status-transitions.test.js
│   │   └── comments-activity.test.js
│   ├── utils/
│   │   └── stateMachine.js        # Status transition validator
│   ├── package.json
│   └── server.js                  # Express app entry point
└── README.md
```
