const crypto = require('crypto');
const prisma = require('../lib/prisma');

const TABLE_NAME = 'TeacherMaterialUser';
const PUBLIC_COLUMNS = [
  'id',
  'name',
  'phone',
  'email',
  'password',
  'packageId',
  'package',
  'paymentReference',
  'amountPaid',
  'proofStatus',
  'confirmedBy',
  'confirmedAt',
  'status',
  'isActive',
  'activatedAt',
  'expiresAt',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
];

let columnCache = null;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getTeacherMaterialUserSchema() {
  if (columnCache) return columnCache;

  const rows = await prisma.$queryRaw`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      is_identity,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'TeacherMaterialUser'
  `;

  columnCache = new Map(rows.map((row) => [row.column_name, row]));
  return columnCache;
}

function selectColumns(columns) {
  return PUBLIC_COLUMNS.filter((column) => columns.has(column)).map(quoteIdentifier).join(', ');
}

function isNumericColumn(column) {
  return ['smallint', 'integer', 'bigint'].includes(String(column?.data_type || '').toLowerCase());
}

function coerceColumnValue(column, value) {
  if (value === undefined || value === null) return value;
  if (isNumericColumn(column)) return Number(value);
  return value;
}

function buildCompatibleId(column) {
  if (!column) return undefined;
  const hasDatabaseDefault = Boolean(column.column_default) || String(column.is_identity || '').toUpperCase() === 'YES';
  if (isNumericColumn(column)) {
    if (hasDatabaseDefault) return undefined;
    throw new Error('TeacherMaterialUser numeric id column requires a database default');
  }

  if (String(column.udt_name || '').toLowerCase() === 'uuid') {
    return crypto.randomUUID();
  }

  const generated = crypto.randomBytes(12).toString('hex');
  const maximumLength = Number(column.character_maximum_length);
  return Number.isFinite(maximumLength) && maximumLength > 0
    ? generated.slice(0, maximumLength)
    : generated;
}

function normalizeTeacherMaterialUser(row, fallback = {}) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || null,
    password: row.password,
    packageId: row.packageId || null,
    package: row.package || fallback.package || null,
    paymentReference: row.paymentReference || null,
    amountPaid: row.amountPaid || null,
    proofStatus: row.proofStatus || 'PENDING',
    confirmedBy: row.confirmedBy || null,
    confirmedAt: row.confirmedAt || null,
    status: row.status || 'PENDING',
    isActive: row.isActive === true,
    activatedAt: row.activatedAt || null,
    expiresAt: row.expiresAt || null,
    lastLoginAt: row.lastLoginAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

async function findTeacherMaterialUserByConditions(conditions = []) {
  const columns = await getTeacherMaterialUserSchema();
  const selectable = selectColumns(columns);
  const filtered = conditions.filter(({ column, value }) => columns.has(column) && value !== undefined && value !== null && value !== '');

  if (!selectable || !filtered.length) return null;

  const values = filtered.map(({ column, value }) => coerceColumnValue(columns.get(column), value));
  const where = filtered.map(({ column }, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${selectable} FROM ${quoteIdentifier(TABLE_NAME)} WHERE ${where} LIMIT 1`,
    ...values
  );

  return normalizeTeacherMaterialUser(rows[0]);
}

async function findTeacherMaterialUserById(id) {
  return findTeacherMaterialUserByConditions([{ column: 'id', value: String(id || '') }]);
}

async function findTeacherMaterialUserByContact({ phone, email }) {
  return findTeacherMaterialUserByConditions([
    { column: 'phone', value: phone },
    { column: 'email', value: email },
  ]);
}

async function createTeacherMaterialUserWithLegacySchema(data) {
  const columns = await getTeacherMaterialUserSchema();
  const now = new Date();
  const id = buildCompatibleId(columns.get('id'));
  const candidates = [
    ['id', id],
    ['name', data.name],
    ['fullName', data.name],
    ['phone', data.phone],
    ['phoneNumber', data.phone],
    ['email', data.email || null],
    ['password', data.password],
    ['packageId', data.packageId || null],
    ['package', data.package || null],
    ['status', data.status || 'PENDING'],
    ['proofStatus', data.proofStatus || 'PENDING'],
    ['isActive', data.isActive === true],
    ['createdAt', now],
    ['updatedAt', now],
  ].filter(([column, value]) => columns.has(column) && value !== undefined);

  const required = ['id', 'name', 'phone', 'password'].filter((column) => !columns.has(column));
  if (required.length) {
    throw new Error(`TeacherMaterialUser table is missing required columns: ${required.join(', ')}`);
  }

  const insertColumns = candidates.map(([column]) => column);
  const values = candidates.map(([column, value]) => coerceColumnValue(columns.get(column), value));
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
  const returning = selectColumns(columns);
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO ${quoteIdentifier(TABLE_NAME)} (${insertColumns.map(quoteIdentifier).join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING ${returning}`,
    ...values
  );

  return normalizeTeacherMaterialUser(rows[0], { package: data.package });
}

async function createTeacherMaterialUser(data) {
  try {
    const user = await prisma.teacherMaterialUser.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        password: data.password,
        packageId: data.packageId || null,
        package: data.package || null,
        status: data.status || 'PENDING',
        proofStatus: data.proofStatus || 'PENDING',
        isActive: data.isActive === true,
      },
    });
    return normalizeTeacherMaterialUser(user, { package: data.package });
  } catch (error) {
    if (error?.code === 'P2002' || error?.code === '23505') throw error;
    console.warn('TeacherMaterialUser Prisma create fell back to legacy schema support:', error?.code || error?.name || 'unknown');
    return createTeacherMaterialUserWithLegacySchema(data);
  }
}

async function updateTeacherMaterialUser(id, data) {
  const columns = await getTeacherMaterialUserSchema();
  const entries = Object.entries(data)
    .filter(([column, value]) => columns.has(column) && value !== undefined);

  if (!entries.length) {
    return findTeacherMaterialUserById(id);
  }

  const values = entries.map(([column, value]) => coerceColumnValue(columns.get(column), value));
  values.push(coerceColumnValue(columns.get('id'), id));
  const setClause = entries.map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`).join(', ');
  const returning = selectColumns(columns);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE ${quoteIdentifier(TABLE_NAME)}
     SET ${setClause}
     WHERE ${quoteIdentifier('id')} = $${values.length}
     RETURNING ${returning}`,
    ...values
  );

  return normalizeTeacherMaterialUser(rows[0]);
}

module.exports = {
  createTeacherMaterialUser,
  findTeacherMaterialUserByContact,
  findTeacherMaterialUserById,
  updateTeacherMaterialUser,
};
