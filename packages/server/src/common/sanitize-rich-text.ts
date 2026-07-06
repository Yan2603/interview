import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'span',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'code', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
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
  },
};

/** 过滤富文本 HTML，防止存储型 XSS */
export function sanitizeRichTextHtml(html: string): string {
  if (!html.trim()) return '';
  return sanitizeHtml(html, OPTIONS);
}
