import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, parseWithSchema, type AuthUser } from '../common';
import { CouplesService } from './couples.service';
import { createCoupleSchema, type CreateCoupleRequest } from './couples.schema';

@UseGuards(JwtAuthGuard)
@Controller('couples')
export class CouplesController {
  constructor(@Inject(CouplesService) private readonly couplesService: CouplesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const request = parseWithSchema<CreateCoupleRequest>(createCoupleSchema, body);
    return this.couplesService.create(user.sub, request);
  }

  @Get('me')
  getMyCouple(@CurrentUser() user: AuthUser) {
    return this.couplesService.getMyCouple(user.sub);
  }
}
