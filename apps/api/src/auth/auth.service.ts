import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginRequest, SignupRequest } from '@little-pieces/shared';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prismaService: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async signup(input: SignupRequest) {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prismaService.user.create({
      data: {
        email: input.email,
        nickname: input.nickname,
        passwordHash,
      },
    });

    return this.createAuthResponse(user);
  }

  async login(input: LoginRequest) {
    const user = await this.prismaService.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, input.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createAuthResponse(user);
  }

  private async createAuthResponse(user: {
    id: string;
    email: string;
    nickname: string;
  }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
    });

    return {
      accessToken,
      user,
    };
  }
}
