import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(
    @Req() req: { user: { id: string; username: string } },
    // LoginDto keeps ValidationPipe engaged; LocalStrategy reads the same body.
    @Body() _dto: LoginDto,
  ) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(
    @Req() req: { user: { id: string } },
    @Body() dto: LogoutDto,
  ) {
    return this.authService
      .logout(req.user.id, dto.refreshToken)
      .then(() => ({ ok: true }));
  }

  @Get('me')
  me(@Req() req: { user: { id: string; username: string } }) {
    return { id: req.user.id, username: req.user.username };
  }
}
