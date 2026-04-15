// server/prisma/seed.js
// FreelanceHub — Database seed script
// Run with: npm run db:seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FreelanceHub database...\n');

  // ── 1. Hash shared password ───────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  // ── 2. Create Admin ───────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@freelancehub.io' },
    update: {},
    create: {
      name: 'FreelanceHub Admin',
      email: 'admin@freelancehub.io',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      wallet: { create: { balance: 0 } },
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── 3. Create Clients ─────────────────────────────────────────────────────
  const clients = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        passwordHash,
        role: 'CLIENT',
        bio: 'Product manager at a fast-growing SaaS startup. Always looking for talented freelancers.',
        location: 'San Francisco, CA',
        isVerified: true,
        wallet: { create: { balance: 2500.00 } },
      },
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        name: 'Bob Martinez',
        email: 'bob@example.com',
        passwordHash,
        role: 'CLIENT',
        bio: 'E-commerce entrepreneur. Building the next big thing in sustainable fashion.',
        location: 'New York, NY',
        isVerified: true,
        wallet: { create: { balance: 1800.00 } },
      },
    }),
  ]);
  console.log(`✅ Clients: ${clients.map((c) => c.email).join(', ')}`);

  // ── 4. Create Freelancers ─────────────────────────────────────────────────
  const freelancers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'carlos@example.com' },
      update: {},
      create: {
        name: 'Carlos Rivera',
        email: 'carlos@example.com',
        passwordHash,
        role: 'FREELANCER',
        bio: 'Full-stack developer with 6 years of experience. React, Node.js, and PostgreSQL specialist.',
        skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'AWS'],
        hourlyRate: 85,
        location: 'Austin, TX',
        availability: true,
        isVerified: true,
        subscriptionPlan: 'PREMIUM',
        wallet: { create: { balance: 340.00 } },
        portfolioItems: {
          create: [
            {
              title: 'E-Commerce Platform',
              description: 'Built a full-stack marketplace with React + Node.js serving 10k daily users.',
              projectUrl: 'https://github.com/carlosrivera/marketplace',
            },
            {
              title: 'Real-Time Chat App',
              description: 'WebSocket-based messaging app with end-to-end encryption.',
              projectUrl: 'https://github.com/carlosrivera/chatapp',
            },
          ],
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'diana@example.com' },
      update: {},
      create: {
        name: 'Diana Chen',
        email: 'diana@example.com',
        passwordHash,
        role: 'FREELANCER',
        bio: 'UI/UX designer and Figma expert. I turn complex problems into beautiful, intuitive interfaces.',
        skills: ['Figma', 'UI/UX Design', 'Prototyping', 'Branding', 'Illustration'],
        hourlyRate: 70,
        location: 'Seattle, WA',
        availability: true,
        isVerified: true,
        wallet: { create: { balance: 150.00 } },
        portfolioItems: {
          create: [
            {
              title: 'FinTech App Redesign',
              description: 'Complete UI overhaul of a mobile banking app, increasing user retention by 35%.',
            },
          ],
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'evan@example.com' },
      update: {},
      create: {
        name: 'Evan Okafor',
        email: 'evan@example.com',
        passwordHash,
        role: 'FREELANCER',
        bio: 'SEO strategist and content writer. I help brands rank on Google and convert visitors into customers.',
        skills: ['SEO', 'Content Writing', 'Copywriting', 'WordPress', 'Google Analytics'],
        hourlyRate: 45,
        location: 'Lagos, Nigeria',
        availability: true,
        wallet: { create: { balance: 0 } },
      },
    }),
  ]);
  console.log(`✅ Freelancers: ${freelancers.map((f) => f.email).join(', ')}`);

  const [alice, bob] = clients;
  const [carlos, diana, evan] = freelancers;

  // ── 5. Create Jobs ────────────────────────────────────────────────────────
  const jobs = await Promise.all([
    prisma.job.upsert({
      where: { id: 'seed-job-001' },
      update: {},
      create: {
        id: 'seed-job-001',
        clientId: alice.id,
        title: 'Build a React Dashboard for SaaS Analytics',
        description:
          'We need a senior React developer to build a data-rich analytics dashboard. The dashboard must display real-time metrics, charts (Recharts or Chart.js), and user activity logs. REST API is already built — you will be consuming it. Responsive design is a must.',
        category: 'Development',
        skills: ['React', 'TypeScript', 'REST APIs', 'CSS'],
        budgetType: 'FIXED',
        budgetAmount: 1200,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'OPEN',
      },
    }),
    prisma.job.upsert({
      where: { id: 'seed-job-002' },
      update: {},
      create: {
        id: 'seed-job-002',
        clientId: bob.id,
        title: 'Design Brand Identity for Sustainable Fashion Store',
        description:
          'Looking for an experienced brand designer to create a complete brand identity package: logo, color palette, typography system, business card, and social media templates. The brand is eco-conscious, minimalist, and targets 25–40 year old professionals.',
        category: 'Design',
        skills: ['Figma', 'Branding', 'Logo Design', 'Illustration'],
        budgetType: 'FIXED',
        budgetAmount: 800,
        status: 'OPEN',
      },
    }),
    prisma.job.upsert({
      where: { id: 'seed-job-003' },
      update: {},
      create: {
        id: 'seed-job-003',
        clientId: alice.id,
        title: 'SEO Audit & Content Strategy for Tech Blog',
        description:
          'Our engineering blog gets decent traffic but poor conversions. Need a SEO specialist to audit our current setup, identify gaps, and deliver a 3-month content strategy with target keywords, recommended articles, and on-page optimisation checklist.',
        category: 'Marketing',
        skills: ['SEO', 'Content Strategy', 'Google Analytics', 'Keyword Research'],
        budgetType: 'HOURLY',
        budgetAmount: 55,
        status: 'OPEN',
      },
    }),
    // A completed job with contract + review for realistic data
    prisma.job.upsert({
      where: { id: 'seed-job-004' },
      update: {},
      create: {
        id: 'seed-job-004',
        clientId: bob.id,
        title: 'Build REST API with Node.js and PostgreSQL',
        description: 'REST API for an e-commerce platform. Already completed.',
        category: 'Development',
        skills: ['Node.js', 'PostgreSQL', 'REST API'],
        budgetType: 'FIXED',
        budgetAmount: 950,
        status: 'COMPLETED',
      },
    }),
  ]);
  console.log(`✅ Jobs: ${jobs.length} created`);

  const [jobDashboard, jobBrand, jobSeo, jobCompleted] = jobs;

  // ── 6. Create Bids ────────────────────────────────────────────────────────
  await prisma.bid.upsert({
    where: { jobId_freelancerId: { jobId: jobDashboard.id, freelancerId: carlos.id } },
    update: {},
    create: {
      jobId: jobDashboard.id,
      freelancerId: carlos.id,
      proposedPrice: 1100,
      coverLetter:
        'Hi Alice! I\'ve built several React dashboards including a real-time analytics platform for a fintech client. I can deliver this in 3 weeks with clean, maintainable code. Happy to share my portfolio.',
      estimatedDays: 21,
      status: 'PENDING',
    },
  });

  await prisma.bid.upsert({
    where: { jobId_freelancerId: { jobId: jobDashboard.id, freelancerId: evan.id } },
    update: {},
    create: {
      jobId: jobDashboard.id,
      freelancerId: evan.id,
      proposedPrice: 1200,
      coverLetter:
        'I have experience with React and data visualization. I can start immediately.',
      estimatedDays: 28,
      status: 'PENDING',
    },
  });

  await prisma.bid.upsert({
    where: { jobId_freelancerId: { jobId: jobBrand.id, freelancerId: diana.id } },
    update: {},
    create: {
      jobId: jobBrand.id,
      freelancerId: diana.id,
      proposedPrice: 750,
      coverLetter:
        'Love this brief! Sustainable fashion is a space I\'m passionate about. I\'ll create a full identity system with 3 concept directions in the first week, then refine based on your feedback. Delivery in 2 weeks.',
      estimatedDays: 14,
      status: 'PENDING',
    },
  });

  // Bids for the completed job (accepted/rejected)
  await prisma.bid.upsert({
    where: { jobId_freelancerId: { jobId: jobCompleted.id, freelancerId: carlos.id } },
    update: {},
    create: {
      jobId: jobCompleted.id,
      freelancerId: carlos.id,
      proposedPrice: 950,
      coverLetter: 'I built many REST APIs with Node.js and PostgreSQL. I can deliver this.',
      estimatedDays: 14,
      status: 'ACCEPTED',
    },
  });

  console.log('✅ Bids: created');

  // ── 7. Create Contract + Review for completed job ─────────────────────────
  const contract = await prisma.contract.upsert({
    where: { id: 'seed-contract-001' },
    update: {},
    create: {
      id: 'seed-contract-001',
      jobId: jobCompleted.id,
      clientId: bob.id,
      freelancerId: carlos.id,
      agreedPrice: 950,
      commission: 47.50, // 5% PREMIUM rate
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.review.upsert({
    where: { contractId: contract.id },
    update: {},
    create: {
      contractId: contract.id,
      clientId: bob.id,
      freelancerId: carlos.id,
      rating: 5,
      comment:
        'Carlos was exceptional — clean code, great communication, and delivered ahead of schedule. Will definitely hire again!',
    },
  });

  console.log('✅ Contract + Review: created');

  // ── 8. Record the escrow release transaction on Carlos's wallet ────────────
  const carlosWallet = await prisma.wallet.findUnique({ where: { userId: carlos.id } });
  const existingTx = await prisma.transaction.findFirst({
    where: { walletId: carlosWallet.id, reference: contract.id },
  });
  if (!existingTx) {
    await prisma.transaction.create({
      data: {
        walletId: carlosWallet.id,
        type: 'ESCROW_RELEASE',
        amount: 902.50, // 950 - 47.50 commission
        reference: contract.id,
      },
    });
  }

  // ── 9. Record a top-up transaction on Alice's wallet ──────────────────────
  const aliceWallet = await prisma.wallet.findUnique({ where: { userId: alice.id } });
  const existingTopup = await prisma.transaction.findFirst({
    where: { walletId: aliceWallet.id },
  });
  if (!existingTopup) {
    await prisma.transaction.create({
      data: {
        walletId: aliceWallet.id,
        type: 'CREDIT',
        amount: 2500,
        reference: 'stripe-seed-session',
      },
    });
  }

  console.log('✅ Transactions: created\n');
  console.log('─────────────────────────────────────────');
  console.log('🎉 Seed complete! Test credentials:');
  console.log('   Admin:      admin@freelancehub.io  /  Password123!');
  console.log('   Client:     alice@example.com       /  Password123!');
  console.log('   Client:     bob@example.com         /  Password123!');
  console.log('   Freelancer: carlos@example.com      /  Password123!');
  console.log('   Freelancer: diana@example.com       /  Password123!');
  console.log('   Freelancer: evan@example.com        /  Password123!');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
