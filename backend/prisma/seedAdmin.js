const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/security');

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@zedexam.com').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || 'admin123').trim();
  const name = String(process.env.ADMIN_NAME || 'System Admin').trim();

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { name, password: hashPassword(password), role: 'Administrator' },
    create: { name, email, password: hashPassword(password), role: 'Administrator' },
  });

  console.log('Admin ready');
  console.log('Email:', admin.email);
  console.log('Password:', password);
}

main()
  .catch((e) => {
    console.error('Seed admin failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
