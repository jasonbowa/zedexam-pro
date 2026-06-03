function toPublicStudent(student) {
  if (!student) return null;
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    phoneNumber: student.phoneNumber,
    phone: student.phoneNumber,
    grade: student.grade,
    school: student.school,
    schoolId: student.schoolId,
    status: student.status || (student.isActive === false ? 'inactive' : 'active'),
    isActive: student.isActive !== false,
    deactivatedAt: student.deactivatedAt || null,
    lastLoginAt: student.lastLoginAt || null,
    updatedAt: student.updatedAt || null,
    createdAt: student.createdAt,
  };
}

function toPublicAdmin(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phoneNumber: admin.phoneNumber,
    role: admin.role,
    createdAt: admin.createdAt,
  };
}

function toPublicTeacherMaterialUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    phoneNumber: user.phone,
    email: user.email,
    packageId: user.packageId || null,
    package: user.package,
    paymentReference: user.paymentReference || null,
    amountPaid: user.amountPaid || null,
    proofStatus: user.proofStatus || 'PENDING',
    confirmedBy: user.confirmedBy || null,
    confirmedAt: user.confirmedAt || null,
    status: user.status || (user.isActive ? 'ACTIVE' : 'PENDING'),
    isActive: user.isActive === true,
    role: 'teacher_materials',
    roleLabel: 'TEACHER_MATERIALS',
    activatedAt: user.activatedAt || null,
    expiresAt: user.expiresAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || null,
  };
}

module.exports = {
  toPublicStudent,
  toPublicAdmin,
  toPublicTeacherMaterialUser,
};
