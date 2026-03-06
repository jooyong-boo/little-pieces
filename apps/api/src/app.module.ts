import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CouplesModule } from './couples/couples.module';
import { MemoriesModule } from './memories/memories.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, CouplesModule, MemoriesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
