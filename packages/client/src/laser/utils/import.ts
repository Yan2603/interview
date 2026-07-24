export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportKind = 'image' | 'svg';

export type ImportValidation =
  | { ok: true; kind: ImportKind }
  | { ok: false; message: string };

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function validateImportFile(file: {
  name: string;
  size: number;
  type: string;
}): ImportValidation {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: '文件不能超过 5MB' };
  }
  const ext = extensionOf(file.name);
  const mime = file.type.toLowerCase();
  if (
    mime === 'image/svg+xml' ||
    ext === 'svg'
  ) {
    return { ok: true, kind: 'svg' };
  }
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
  ) {
    return { ok: true, kind: 'image' };
  }
  return { ok: false, message: '仅支持图片或 SVG 文件' };
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
