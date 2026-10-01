import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(connectionString: string) {
    super({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  }
}
