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

  const role = String(signedPayload.role || '').toLowerCase();
  const isTeacherMaterials = role === 'teacher_materials' || role === 'teacher-materials';

  return {
    id: isTeacherMaterials ? String(signedPayload.id) : Number(signedPayload.id),
    role,
    isAdmin: role === 'admin' || Boolean(signedPayload.isAdmin),
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

      const accountStatus = String(student.status || '').toLowerCase();
      if (student.isActive === false || ['inactive', 'pending', 'pending_payment', 'suspended'].includes(accountStatus)) {
        const message = accountStatus === 'pending_payment' || accountStatus === 'pending'
          ? 'Your student account is pending payment confirmation. Please contact the administrator after sending proof of payment.'
          : 'Your student account is currently deactivated. Please contact the administrator.';
        return res.status(403).json({ message });
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

async function requireTeacherMaterials(req, res, next) {
  if (!req.user || req.user.role !== 'teacher_materials') {
    return res.status(401).json({ message: 'Teacher Materials login required' });
  }

  try {
    const user = await prisma.teacherMaterialUser.findUnique({ where: { id: String(req.user.id) } });
    if (!user) {
      return res.status(401).json({ message: 'Teacher Materials account was not found' });
    }

    req.currentTeacherMaterialUser = user;
    return next();
  } catch (error) {
    console.error('Teacher materials auth validation error:', error);
    return res.status(500).json({ message: 'Failed to validate Teacher Materials account' });
  }
}

async function requireActiveTeacherMaterials(req, res, next) {
  await requireTeacherMaterials(req, res, () => {
    const user = req.currentTeacherMaterialUser;
    const status = String(user.status || '').toUpperCase();
    const expiredByDate = user.expiresAt ? new Date(user.expiresAt).getTime() < Date.now() : false;

    if (user.isActive !== true || status !== 'ACTIVE' || expiredByDate) {
      if (expiredByDate && status === 'ACTIVE') {
        prisma.teacherMaterialUser.update({
          where: { id: user.id },
          data: { status: 'EXPIRED', isActive: false },
        }).catch(() => null);
      }
      return res.status(403).json({
        message: 'Teacher Materials access is not active yet',
        status: expiredByDate ? 'EXPIRED' : status || 'PENDING',
        isActive: false,
      });
    }

    return next();
  });
}

module.exports = {
  attachAuth,
  requireAuth,
  requireAdmin,
  requireTeacherMaterials,
  requireActiveTeacherMaterials,
};
