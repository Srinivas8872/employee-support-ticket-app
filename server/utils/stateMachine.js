/**
 * Finite State Machine validator for strict forward-only ticket progression:
 * Open -> In Progress -> Resolved -> Closed
 */
const VALID_TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['Resolved'],
  Resolved: ['Closed'],
  Closed: [],
};

const VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

/**
 * Validates target status transition from current status.
 * @param {string} currentStatus Current ticket status.
 * @param {string} targetStatus Desired target status.
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function checkStatusTransition(currentStatus, targetStatus) {
  if (!VALID_STATUSES.includes(targetStatus)) {
    return {
      valid: false,
      code: 400,
      message: `Invalid status "${targetStatus}". Supported statuses are: ${VALID_STATUSES.join(', ')}.`,
    };
  }

  if (currentStatus === 'Closed') {
    return {
      valid: false,
      code: 409,
      message: 'Closed tickets cannot change status.',
    };
  }

  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      code: 400,
      message: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Progression must follow Open -> In Progress -> Resolved -> Closed.`,
    };
  }

  return { valid: true };
}

module.exports = {
  VALID_TRANSITIONS,
  VALID_STATUSES,
  checkStatusTransition,
};
