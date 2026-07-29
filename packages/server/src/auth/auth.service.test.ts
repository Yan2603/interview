import { createHash, randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

type UserRecord = {
  _id: string;
  username: string;
  passwordHash: string;
};

type RefreshRecord = {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

function createUserModelMock(store: Map<string, UserRecord>) {
  return {
    async create(data: { username: string; passwordHash: string }) {
      const _id = randomUUID();
      const doc: UserRecord = { _id, username: data.username, passwordHash: data.passwordHash };
      store.set(_id, doc);
      return doc;
    },
    async findOne(query: { username?: string; _id?: string }) {
      for (const doc of store.values()) {
        if (query.username !== undefined && doc.username === query.username) return doc;
        if (query._id !== undefined && doc._id === query._id) return doc;
      }
      return null;
    },
  };
}

function createRefreshModelMock(store: Map<string, RefreshRecord>) {
  return {
    async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
      const _id = randomUUID();
      const doc: RefreshRecord = {
        _id,
        userId: String(data.userId),
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      };
      store.set(_id, doc);
      return doc;
    },
    async findOne(query: { tokenHash?: string }) {
      for (const doc of store.values()) {
        if (query.tokenHash !== undefined && doc.tokenHash === query.tokenHash) {
          return doc;
        }
      }
      return null;
    },
    async deleteOne(query: { tokenHash?: string; userId?: string; _id?: string }) {
      for (const [id, doc] of store.entries()) {
        if (query._id !== undefined && doc._id !== query._id) continue;
        if (query.tokenHash !== undefined && doc.tokenHash !== query.tokenHash) continue;
        if (query.userId !== undefined && doc.userId !== String(query.userId)) continue;
        store.delete(id);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    const userStore = new Map<string, UserRecord>();
    const refreshStore = new Map<string, RefreshRecord>();
    const userModelMock = createUserModelMock(userStore);
    const refreshModelMock = createRefreshModelMock(refreshStore);
    const jwtServiceMock = {
      signAsync: async (
        payload: { sub: string; username: string },
        options?: { secret?: string; expiresIn?: string },
      ) =>
        `access.${payload.sub}.${payload.username}.${options?.expiresIn ?? '15m'}`,
    };
    const configMock = {
      get: (key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '7d',
        };
        return values[key];
      },
    };

    service = new AuthService(
      userModelMock as never,
      refreshModelMock as never,
      jwtServiceMock as never,
      configMock as never,
    );
  });

  it('createUser throws ConflictException for duplicate username', async () => {
    await service.createUser('dup', 'Correct1!');
    await expect(service.createUser('dup', 'Other1!')).rejects.toMatchObject({
      message: '用户名已存在',
      constructor: ConflictException,
    });
  });

  it('validateUser returns null for wrong password', async () => {
    await service.createUser('alice', 'Correct1!');
    expect(await service.validateUser('alice', 'wrong')).toBeNull();
  });

  it('refresh rotates token and rejects reused old refresh', async () => {
    const user = await service.createUser('bob', 'Correct1!');
    const first = await service.login(user);
    const second = await service.refresh(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout prevents further refresh', async () => {
    const user = await service.createUser('carol', 'Correct1!');
    const tokens = await service.login(user);
    await service.logout(user.id, tokens.refreshToken);
    await expect(service.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('hashToken returns sha256 hex', () => {
    const raw = 'sample-refresh-token';
    expect(service.hashToken(raw)).toBe(
      createHash('sha256').update(raw).digest('hex'),
    );
  });
});
