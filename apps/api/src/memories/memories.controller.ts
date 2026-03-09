import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import type { MemorySummary } from '@little-pieces/shared';
import { memorySchema } from '@little-pieces/shared';
import { CurrentUser, JwtAuthGuard, parseWithSchema, type AuthUser } from '../common';
import { MemoriesService } from './memories.service';

type CreateMemoryRequest = {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  visitedAt: string;
};

@UseGuards(JwtAuthGuard)
@Controller('memories')
export class MemoriesController {
  constructor(@Inject(MemoriesService) private readonly memoriesService: MemoriesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const request = parseWithSchema<CreateMemoryRequest>(memorySchema, body);
    return this.memoriesService.create(user.sub, request);
  }

  @Get('me')
  list(@CurrentUser() user: AuthUser): Promise<Array<MemorySummary & { description?: string; authorUserId?: string }>> {
    return this.memoriesService.listMine(user.sub);
  }
}
