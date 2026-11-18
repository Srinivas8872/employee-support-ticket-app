const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT valid for 24 hours.
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'demo_student_jwt_secret_key_12345';
  return jwt.sign({ userId, role }, secret, { expiresIn: '24h' });
};

module.exports = { generateToken };
