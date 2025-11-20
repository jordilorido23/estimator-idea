import { PrismaClient, TradeType } from '@prisma/client';

const prisma = new PrismaClient();

const demoContractors = [
  {
    companyName: 'ScopeGuard Builders',
    slug: 'scopeguard-builders',
    email: 'intake@scopeguard.builders',
    phone: '555-222-0148',
    trades: [
      TradeType.KITCHEN,
      TradeType.BATH,
      TradeType.ADDITION,
      TradeType.SIDING,
      TradeType.ROOFING
    ]
  }
];

async function main() {
  for (const contractor of demoContractors) {
    await prisma.contractor.upsert({
      where: { slug: contractor.slug },
      update: {
        companyName: contractor.companyName,
        email: contractor.email,
        phone: contractor.phone,
        trades: contractor.trades
      },
      create: {
        companyName: contractor.companyName,
        slug: contractor.slug,
        email: contractor.email,
        phone: contractor.phone,
        trades: contractor.trades
      }
    });
  }

  console.info(`Seeded ${demoContractors.length} contractor${demoContractors.length === 1 ? '' : 's'}.`);
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
