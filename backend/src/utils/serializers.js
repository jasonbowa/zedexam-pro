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

module.exports = {
  toPublicStudent,
  toPublicAdmin,
};
