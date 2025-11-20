import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import { LeadsClient } from './leads-client';

type SearchParams = {
  status?: string;
  tradeType?: string;
  sort?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await auth();
  const userEmail = user.sessionClaims?.email as string | undefined;

  if (!userEmail) {
    redirect('/sign-in');
  }

  const contractorUser = await prisma.contractorUser.findUnique({
    where: { email: userEmail },
    include: {
      contractor: true,
    },
  });

  if (!contractorUser) {
    redirect('/sign-in');
  }

  // Build where clause from filters
  const where: any = {
    contractorId: contractorUser.contractor.id,
  };

  if (searchParams.status) {
    where.status = searchParams.status;
  }

  if (searchParams.tradeType) {
    where.tradeType = searchParams.tradeType;
  }

  // Build orderBy
  const orderBy: any = {};
  if (searchParams.sort === 'score') {
    orderBy.score = 'desc';
  } else if (searchParams.sort === 'oldest') {
    orderBy.createdAt = 'asc';
  } else {
    orderBy.createdAt = 'desc'; // default to newest first
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    include: {
      photos: {
        take: 1,
      },
      takeoffs: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return (
    <LeadsClient
      leads={leads}
      initialStatus={searchParams.status}
      initialSort={searchParams.sort || 'newest'}
    />
  );
}
