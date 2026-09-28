import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AccessGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Alias for the authenticated profile' })
  me(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const { id, email, displayName, role, active, available } = req.auth!;
    const user = { id, email, displayName, role, active, available };
    return { data: user, requestId: res.locals.requestId };
  }

  @Get('staff')
  @Roles('MANAGER')
  @ApiOperation({ summary: 'Manager-only bounded staff routing directory' })
  @ApiOkResponse({ description: 'Safe active staff projections with teams and skills' })
  async staff(@Res({ passthrough: true }) res: Response) {
    const rows = await this.prisma.user.findMany({
      where: { role: 'STAFF', active: true }, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, email: true, displayName: true, available: true, teamMembers: { where: { active: true }, select: { team: { select: { id: true, code: true, name: true } } } }, staffSkills: { select: { skill: { select: { id: true, code: true, name: true } } } } },
    });
    return { data: rows.map((row) => ({ id: row.id, email: row.email, displayName: row.displayName, available: row.available, teams: row.teamMembers.map(({ team }) => team), skills: row.staffSkills.map(({ skill }) => skill) })), page: { nextCursor: null, hasMore: false }, requestId: res.locals.requestId };
  }
}
