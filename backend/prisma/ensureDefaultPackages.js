const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.subscriptionPackage.upsert({
    where: { name: 'Teacher Materials' },
    update: {},
    create: {
      name: 'Teacher Materials',
      description: 'Teacher-only access to teaching notes, guides, classroom support materials, and downloadable PDFs.',
      durationDays: 90,
      priceZmw: 200,
      maxSubjects: null,
      maxMockExams: null,
      includesReports: false,
      includesCertificates: false,
      active: true,
    },
  });
}

main()
  .catch((error) => {
    console.error('Failed to ensure default subscription packages:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
