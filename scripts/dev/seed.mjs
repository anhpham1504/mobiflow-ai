import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const target = new URL(databaseUrl);
const databaseName = target.pathname.slice(1);
if (process.env.DEMO_MODE !== 'true' || !['localhost', '127.0.0.1'].includes(target.hostname) || !['mobiflow', 'mobiflow_m2_test'].includes(databaseName)) {
  throw new Error('Refusing demo seed: require DEMO_MODE=true and an allowlisted loopback demo database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const demoPassword = 'MobiFlowDemo!2026';
const passwordOptions = { type: argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 };

const users = [
  ['10000000-0000-4000-8000-000000000001', 'user@mobiflow.local', 'Demo Requester', 'USER', true],
  ['10000000-0000-4000-8000-000000000002', 'manager@mobiflow.local', 'Demo Manager', 'MANAGER', true],
  ['10000000-0000-4000-8000-000000000003', 'staff.iot@mobiflow.local', 'IoT Specialist', 'STAFF', true],
  ['10000000-0000-4000-8000-000000000004', 'staff.network@mobiflow.local', 'Network Specialist', 'STAFF', true],
  ['10000000-0000-4000-8000-000000000005', 'staff.support@mobiflow.local', 'Customer Support Specialist', 'STAFF', true],
  ['10000000-0000-4000-8000-000000000006', 'staff.billing@mobiflow.local', 'Billing Specialist', 'STAFF', true],
];
const teams = [
  ['20000000-0000-4000-8000-000000000001', 'NETWORK_OPERATIONS', 'Network Operations'],
  ['20000000-0000-4000-8000-000000000002', 'CUSTOMER_SUPPORT', 'Customer Support'],
  ['20000000-0000-4000-8000-000000000003', 'BILLING_SUPPORT', 'Billing Support'],
  ['20000000-0000-4000-8000-000000000004', 'SERVICE_OPERATIONS', 'Service Operations'],
];
const skills = [
  ['30000000-0000-4000-8000-000000000001', 'IOT', 'IoT'],
  ['30000000-0000-4000-8000-000000000002', 'NETWORK', 'Network'],
  ['30000000-0000-4000-8000-000000000003', 'BILLING', 'Billing'],
  ['30000000-0000-4000-8000-000000000004', 'ACCOUNT', 'Account'],
  ['30000000-0000-4000-8000-000000000005', 'CUSTOMER_SUPPORT', 'Customer Support'],
];
const teamMemberships = [
  ['40000000-0000-4000-8000-000000000001', users[2][0], teams[0][0]],
  ['40000000-0000-4000-8000-000000000002', users[3][0], teams[0][0]],
  ['40000000-0000-4000-8000-000000000003', users[4][0], teams[1][0]],
  ['40000000-0000-4000-8000-000000000004', users[4][0], teams[3][0]],
  ['40000000-0000-4000-8000-000000000005', users[5][0], teams[2][0]],
];
const staffSkills = [
  [users[2][0], skills[0][0]], [users[2][0], skills[1][0]],
  [users[3][0], skills[1][0]], [users[3][0], skills[0][0]],
  [users[4][0], skills[3][0]], [users[4][0], skills[4][0]],
  [users[5][0], skills[2][0]],
];
const slaPolicies = [
  ['50000000-0000-4000-8000-000000000001', 'LOW', 480],
  ['50000000-0000-4000-8000-000000000002', 'MEDIUM', 240],
  ['50000000-0000-4000-8000-000000000003', 'HIGH', 120],
  ['50000000-0000-4000-8000-000000000004', 'URGENT', 60],
];

try {
  const existingRows = await prisma.user.findMany({ where: { id: { in: users.map(([id]) => id) } }, select: { id: true, passwordHash: true } });
  const existing = new Set(existingRows.map(({ id }) => id));
  const passwordHashes = new Map();
  for (const row of existingRows) passwordHashes.set(row.id, row.passwordHash);
  for (const [id] of users) if (!existing.has(id)) passwordHashes.set(id, await hash(demoPassword, passwordOptions));
  await prisma.$transaction(async (tx) => {
    for (const [id, email, displayName, role, available] of users) {
      await tx.user.upsert({ where: { id }, create: { id, email, displayName, role, active: true, available, passwordHash: passwordHashes.get(id) }, update: { email, displayName, role, active: true, available } });
    }
    for (const [id, code, name] of teams) await tx.team.upsert({ where: { id }, create: { id, code, name }, update: { code, name, active: true } });
    for (const [id, code, name] of skills) await tx.skill.upsert({ where: { id }, create: { id, code, name }, update: { code, name } });
    for (const [id, userId, teamId] of teamMemberships) await tx.teamMember.upsert({ where: { id }, create: { id, userId, teamId }, update: { userId, teamId, active: true } });
    for (const [staffId, skillId] of staffSkills) await tx.staffSkill.upsert({ where: { staffId_skillId: { staffId, skillId } }, create: { staffId, skillId }, update: {} });
    for (const [id, priority, targetMinutes] of slaPolicies) await tx.slaPolicy.upsert({ where: { id }, create: { id, category: null, priority, targetMinutes }, update: { category: null, priority, targetMinutes, active: true, version: 1 } });
  });
  const counts = {
    users: await prisma.user.count({ where: { id: { in: users.map(([id]) => id) } } }),
    teams: await prisma.team.count({ where: { id: { in: teams.map(([id]) => id) } } }),
    skills: await prisma.skill.count({ where: { id: { in: skills.map(([id]) => id) } } }),
    memberships: await prisma.teamMember.count({ where: { id: { in: teamMemberships.map(([id]) => id) } } }),
    staffSkills: await prisma.staffSkill.count({ where: { OR: staffSkills.map(([staffId, skillId]) => ({ staffId, skillId })) } }),
    slaPolicies: await prisma.slaPolicy.count({ where: { id: { in: slaPolicies.map(([id]) => id) } } }),
  };
  const expected = { users: 6, teams: 4, skills: 5, memberships: 5, staffSkills: 7, slaPolicies: 4 };
  if (JSON.stringify(counts) !== JSON.stringify(expected)) throw new Error(`Seed verification failed: ${JSON.stringify(counts)}`);
  console.log(JSON.stringify({ event: 'demo.seed.complete', database: databaseName, counts }));
} finally {
  await prisma.$disconnect();
}
