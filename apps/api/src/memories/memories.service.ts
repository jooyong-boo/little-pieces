import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateMemoryRequest {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  visitedAt: string;
}

@Injectable()
export class MemoriesService {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async create(userId: string, input: CreateMemoryRequest) {
    const membership = await this.prismaService.coupleMember.findFirst({
      where: { userId },
      select: { coupleId: true },
    });

    if (!membership) {
      throw new ForbiddenException('User must belong to a couple before creating memories.');
    }

    const memory = await this.prismaService.memory.create({
      data: {
        coupleId: membership.coupleId,
        authorUserId: userId,
        title: input.title,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        visitedAt: new Date(input.visitedAt),
      },
    });

    return {
      id: memory.id,
      title: memory.title,
      description: memory.description ?? undefined,
      latitude: memory.latitude,
      longitude: memory.longitude,
      visitedAt: memory.visitedAt.toISOString(),
      authorUserId: memory.authorUserId ?? undefined,
    };
  }

  async listMine(userId: string) {
    const membership = await this.prismaService.coupleMember.findFirst({
      where: { userId },
      select: { coupleId: true },
    });

    if (!membership) {
      return [];
    }

    const memories = await this.prismaService.memory.findMany({
      where: { coupleId: membership.coupleId },
      orderBy: { visitedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        latitude: true,
        longitude: true,
        visitedAt: true,
        authorUserId: true,
      },
    });

    return memories.map((memory) => ({
      id: memory.id,
      title: memory.title,
      description: memory.description ?? undefined,
      latitude: memory.latitude,
      longitude: memory.longitude,
      visitedAt: memory.visitedAt.toISOString(),
      authorUserId: memory.authorUserId ?? undefined,
    }));
  }
}
