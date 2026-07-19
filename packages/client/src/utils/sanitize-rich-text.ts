import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'span',
  'ul', 'ol', 'li',
  'blockquote',
  'a', 'code', 'pre',
  'img',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'title', 'style', 'src', 'alt', 'width', 'height'];

function isAllowedUploadSrc(src: string): boolean {
  return src.startsWith('/uploads/') && !src.includes('..');
}

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.nodeName === 'IMG' && data.attrName === 'src') {
    if (!isAllowedUploadSrc(data.attrValue)) {
      data.keepAttr = false;
    }
  }
});

/** 过滤富文本 HTML，用于 wangEditor 内容的存取 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html.trim()) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
