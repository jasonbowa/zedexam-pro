const TEACHER_PACKAGE_NAME_FILTER = {
  contains: 'Teacher',
  mode: 'insensitive',
};

function isTeacherMaterialsPackage(value) {
  const name = typeof value === 'object' && value ? value.name : value;
  return /teacher/i.test(String(name || ''));
}

function getStudentPackageWhere(extra = {}) {
  return {
    ...extra,
    NOT: {
      name: TEACHER_PACKAGE_NAME_FILTER,
    },
  };
}

function getTeacherPackageWhere(extra = {}) {
  return {
    ...extra,
    name: TEACHER_PACKAGE_NAME_FILTER,
  };
}

module.exports = {
  getStudentPackageWhere,
  getTeacherPackageWhere,
  isTeacherMaterialsPackage,
};
