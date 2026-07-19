import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';

/** 解析上传根目录，并确保 images 子目录存在 */
export function resolveUploadRoot(configured?: string): string {
  let root: string;
  if (configured) {
    root = isAbsolute(configured) ? configured : join(process.cwd(), configured);
  } else {
    const cwd = process.cwd();
    // 本地 monorepo：cwd 常在 packages/server
    if (/packages[/\\]server$/i.test(cwd)) {
      root = join(cwd, '..', '..', 'uploads');
    } else {
      // Docker runner：cwd 为 /app
      root = join(cwd, 'uploads');
    }
  }

  const imagesDir = join(root, 'images');
  mkdirSync(imagesDir, { recursive: true });
  return root;
}

export function getImagesDir(uploadRoot: string): string {
  const imagesDir = join(uploadRoot, 'images');
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}
