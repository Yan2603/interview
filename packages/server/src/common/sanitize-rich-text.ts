import sanitizeHtml from 'sanitize-html';

function isAllowedUploadSrc(src: string | undefined): boolean {
  if (!src) return false;
  // 仅允许同源上传路径，禁止 data: / 外链
  return src.startsWith('/uploads/') && !src.includes('..');
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'span',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'code', 'pre',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    span: ['style'],
    p: ['style'],
    div: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    h5: ['style'],
    h6: ['style'],
    li: ['style'],
    strong: ['style'],
    em: ['style'],
    u: ['style'],
    s: ['style'],
    del: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-weight': [/^bold$/, /^normal$/, /^\d+$/],
      'font-style': [/^italic$/, /^normal$/],
      'text-decoration': [/^underline$/, /^line-through$/, /^none$/],
    },
    img: {
      width: [/^\d+(?:\.\d+)?(?:px|%)?$/i, /^auto$/i],
      height: [/^\d+(?:\.\d+)?(?:px|%)?$/i, /^auto$/i],
      'max-width': [/^\d+(?:\.\d+)?(?:px|%)?$/i],
    },
  },
  transformTags: {
    img: (_tagName, attribs) => {
      if (!isAllowedUploadSrc(attribs.src)) {
        return { tagName: 'span', text: '', attribs: {} };
      }
      const next: Record<string, string> = {
        src: attribs.src,
        alt: attribs.alt ?? '',
      };
      if (attribs.width) next.width = attribs.width;
      if (attribs.height) next.height = attribs.height;
      if (attribs.style) next.style = attribs.style;
      return { tagName: 'img', attribs: next };
    },
  },
};

/** 过滤富文本 HTML，防止存储型 XSS */
export function sanitizeRichTextHtml(html: string): string {
  if (!html.trim()) return '';
  return sanitizeHtml(html, OPTIONS);
}
