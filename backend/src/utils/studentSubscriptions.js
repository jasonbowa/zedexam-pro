const prisma = require('../lib/prisma');

let schemaReadyPromise = null;

async function createSubscriptionStatusType() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'INACTIVE', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$
  `);
}

async function initializeStudentSubscriptionSchema() {
  await createSubscriptionStatusType();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudentSubscription" (
      "id" SERIAL PRIMARY KEY,
      "studentId" INTEGER NOT NULL,
      "packageId" INTEGER NOT NULL,
      "schoolId" INTEGER,
      "sponsorName" TEXT,
      "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "activationCode" TEXT,
      "paymentReference" TEXT,
      "amountPaid" DECIMAL(10, 2),
      "proofStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "confirmedBy" TEXT,
      "confirmedAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = [
    ['schoolId', 'INTEGER'],
    ['sponsorName', 'TEXT'],
    ['status', "\"SubscriptionStatus\" NOT NULL DEFAULT 'PENDING'"],
    ['startDate', 'TIMESTAMP(3)'],
    ['endDate', 'TIMESTAMP(3)'],
    ['activationCode', 'TEXT'],
    ['paymentReference', 'TEXT'],
    ['amountPaid', 'DECIMAL(10, 2)'],
    ['proofStatus', "TEXT NOT NULL DEFAULT 'PENDING'"],
    ['confirmedBy', 'TEXT'],
    ['confirmedAt', 'TIMESTAMP(3)'],
    ['notes', 'TEXT'],
    ['createdAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ];

  for (const [name, definition] of columns) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "StudentSubscription" ADD COLUMN IF NOT EXISTS "${name}" ${definition}`
    );
  }

  const indexes = [
    'CREATE INDEX IF NOT EXISTS "StudentSubscription_studentId_idx" ON "StudentSubscription"("studentId")',
    'CREATE INDEX IF NOT EXISTS "StudentSubscription_packageId_idx" ON "StudentSubscription"("packageId")',
    'CREATE INDEX IF NOT EXISTS "StudentSubscription_schoolId_idx" ON "StudentSubscription"("schoolId")',
    'CREATE INDEX IF NOT EXISTS "StudentSubscription_status_idx" ON "StudentSubscription"("status")',
  ];

  for (const statement of indexes) {
    await prisma.$executeRawUnsafe(statement);
  }
}

function ensureStudentSubscriptionSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = initializeStudentSubscriptionSchema().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

module.exports = {
  ensureStudentSubscriptionSchema,
};
