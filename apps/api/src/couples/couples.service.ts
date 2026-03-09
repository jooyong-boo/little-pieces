import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoupleMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCoupleRequest } from './couples.schema';

@Injectable()
export class CouplesService {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async create(userId: string, input: CreateCoupleRequest) {
    const existingMembership = await this.prismaService.coupleMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('User already belongs to a couple.');
    }

    const couple = await this.prismaService.couple.create({
      data: {
        name: input.name,
        anniversaryDate: input.anniversaryDate ? new Date(input.anniversaryDate) : null,
        createdByUserId: userId,
        members: {
          create: {
            userId,
            role: CoupleMemberRole.OWNER,
          },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    const membership = couple.members[0];

    if (!membership) {
      throw new ForbiddenException('Couple membership was not created.');
    }

    return {
      id: couple.id,
      name: couple.name,
      anniversaryDate: couple.anniversaryDate?.toISOString(),
      role: membership.role,
    };
  }

  async getMyCouple(userId: string) {
    const membership = await this.prismaService.coupleMember.findFirst({
      where: { userId },
      include: {
        couple: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Couple not found for user.');
    }

    return {
      id: membership.couple.id,
      name: membership.couple.name,
      anniversaryDate: membership.couple.anniversaryDate?.toISOString(),
      role: membership.role,
    };
  }
}
