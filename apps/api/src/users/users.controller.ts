import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.sub);
  }
}
