import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async health() {
    const database = await this.checkDatabase();

    return {
      service: 'api',
      status: 'ok',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    if (!process.env.DATABASE_URL) {
      return {
        status: 'not_configured',
      };
    }

    try {
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        status: 'connected',
      };
    } catch {
      return {
        status: 'error',
      };
    }
  }
}
