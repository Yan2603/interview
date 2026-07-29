import { createHash, randomBytes } from 'crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { User, UserDocument } from './schemas/user.schema';

export type AuthUser = { id: string; username: string };

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async createUser(
    username: string,
    password: string,
  ): Promise<AuthUser> {
    const existing = await this.userModel.findOne({ username });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await this.userModel.create({ username, passwordHash });
      return { id: String(user._id), username: user.username };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw new ConflictException('用户名已存在');
      }
      throw err;
    }
  }

  async validateUser(
    username: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.userModel.findOne({ username });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return { id: String(user._id), username: user.username };
  }

  async login(user: AuthUser): Promise<AuthTokens> {
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.refreshModel.findOne({ tokenHash });
    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      if (existing) {
        await this.refreshModel.deleteOne({ _id: existing._id });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshModel.deleteOne({ _id: existing._id });

    const user = await this.userModel.findOne({ _id: existing.userId });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens({
      id: String(user._id),
      username: user.username,
    });
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshModel.deleteOne({ userId, tokenHash });
  }

  private async issueTokens(user: AuthUser): Promise<AuthTokens> {
    const accessSecret = this.requireConfig('JWT_ACCESS_SECRET');
    const accessTtl = this.requireConfig('JWT_ACCESS_TTL');
    const refreshTtl = this.requireConfig('JWT_REFRESH_TTL');

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, username: user.username },
      {
        secret: accessSecret,
        expiresIn: accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const rawRefresh = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);
    const expiresAt = addTtl(new Date(), refreshTtl);

    await this.refreshModel.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: accessTtl,
    };
  }

  private requireConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing config: ${key}`);
    }
    return value;
  }
}

function addTtl(from: Date, ttl: string): Date {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL: ${ttl}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(from.getTime() + amount * multipliers[unit]);
}
