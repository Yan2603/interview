import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from './auth.service';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const username = readArg('--username');
  const password = readArg('--password');
  if (!username || !password) {
    console.error('Usage: create-user -- --username <name> --password <pass>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const auth = app.get(AuthService);

  try {
    const user = await auth.createUser(username, password);
    console.log(`Created user ${user.username} id=${user.id}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
