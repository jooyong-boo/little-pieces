import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn(
        'DATABASE_URL is not set. Prisma DB connection is skipped until environment variables are configured.',
      );
      return;
    }

    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        `Prisma DB connection failed during bootstrap. Runtime queries will keep using the configured datasource. ${this.formatErrorMessage(error)}`,
      );
    }
  }

  private formatErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown connection error.';
  }
}
