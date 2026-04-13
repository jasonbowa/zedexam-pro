const prisma = require('../lib/prisma');
const env = require('../config/env');
const { verifyToken } = require('../utils/security');

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const tokenHeader = req.headers['x-auth-token'] || req.headers['x-access-token'];
  if (tokenHeader) return String(tokenHeader).trim();

  return null;
}

function buildAuthPayloadFromToken(token) {
  if (!token) return null;

  const signedPayload = verifyToken(token, env.AUTH_SECRET);
  if (!signedPayload?.id || !signedPayload?.role) {
    return null;
  }

  return {
    id: Number(signedPayload.id),
    role: signedPayload.role,
    isAdmin: signedPayload.role === 'admin' || Boolean(signedPayload.isAdmin),
  };
}

function attachAuth(req, _res, next) {
  const token = extractToken(req);
  const user = buildAuthPayloadFromToken(token);
  req.authToken = token;
  req.user = user;
  next();
}

async function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.isAdmin && req.user.role === 'student') {
    try {
      const student = await prisma.student.findUnique({ where: { id: Number(req.user.id) } });

      if (!student || student.deletedAt) {
        return res.status(401).json({ message: 'Student account was not found or has been removed' });
      }

      if (student.isActive === false || String(student.status || '').toLowerCase() === 'inactive') {
        return res.status(403).json({ message: 'Your student account is currently deactivated. Please contact the administrator.' });
      }

      req.currentStudent = student;
    } catch (error) {
      console.error('Auth student validation error:', error);
      return res.status(500).json({ message: 'Failed to validate current user' });
    }
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = {
  attachAuth,
  requireAuth,
  requireAdmin,
};
