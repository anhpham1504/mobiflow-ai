import {Prisma} from '../generated/prisma/client.js';
// Shared by human assignment and AI candidate selection. Callers use aliases u/m/t.
export const eligibleStaffPredicate=()=>Prisma.sql`t.active AND m.active AND u.active AND u.available AND u.role='STAFF'`;
