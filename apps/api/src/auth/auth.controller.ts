import { Body, Controller, Inject, Post } from '@nestjs/common';
import type { LoginRequest, SignupRequest } from '@little-pieces/shared';
import { loginSchema, signupSchema } from '@little-pieces/shared';
import { parseWithSchema } from '../common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() body: unknown) {
    const request = parseWithSchema<SignupRequest>(signupSchema, body);
    return this.authService.signup(request);
  }

  @Post('login')
  login(@Body() body: unknown) {
    const request = parseWithSchema<LoginRequest>(loginSchema, body);
    return this.authService.login(request);
  }
}
