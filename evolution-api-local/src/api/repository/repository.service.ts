import { ConfigService } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { PrismaClient } from '@prisma/client';

export class Query<T> {
  where?: T;
  sort?: 'asc' | 'desc';
  page?: number;
  offset?: number;
}

export class PrismaRepository extends PrismaClient {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  private readonly logger = new Logger('PrismaRepository');

  public async onModuleInit() {
    if (this.configService.get('DATABASE').ENABLED) {
      await this.$connect();
      this.logger.info('Repository:Prisma - ON');
    } else {
      this.logger.warn('Repository:Prisma - OFF (Database Disabled)');
    }
  }

  public async onModuleDestroy() {
    await this.$disconnect();
    this.logger.warn('Repository:Prisma - OFF');
  }
}
