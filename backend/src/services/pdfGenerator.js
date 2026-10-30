import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { load } from 'cheerio';
import { existsSync, readFileSync, statSync } from 'node:fs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { campusError } from '../campus/errors.js';
import { logEvent, safeErrorMetadata } from '../utils/diagnostics.js';

let active = false;
export function heavyWorkBusy() { return active; }
export function tryAcquireHeavyWork() {
  if (active) return false;
  active = true;
  return true;
}
export function releaseHeavyWork() { active = false; }
const allowedTags = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'hr', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span']);
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function sanitizeResumeHtml(html) {
  const $ = load(html, null, false);
  $('script,style,iframe,object,embed,svg,math,form,input,link,meta,base,img,video,audio').remove();
  $('*').each((_index, element) => {
    if (!allowedTags.has(element.tagName)) { $(element).replaceWith($(element).contents()); return; }
    for (const attribute of Object.keys(element.attribs || {})) $(element).removeAttr(attribute);
  });
  return $.html();
}

export function assertPdfLayout(pages) {
  if (pages.length > 2 || (pages[1] && pages[1].some((item) => item.text.trim() && item.bottom < (297 / 2) * 72 / 25.4))) {
    throw campusError(422, 'RESUME_TOO_LONG', '简历超过一页半 A4 的可打印篇幅，请精简内容后导出；内容未被截断。');
  }
}

export function pdfFailureMetadata(error, stage) {
  const metadata = safeErrorMetadata(error);
  const stages = new Set(['sanitize', 'launch', 'page', 'content', 'fonts', 'print', 'parse']);
  const safeStage = stages.has(stage) ? stage : 'sanitize';
  const code = error?.name === 'TimeoutError' ? 'PDF_TIMEOUT' : error?.name === 'TargetCloseError' ? 'PDF_BROWSER_CLOSED' : error?.name === 'ProtocolError' ? 'PDF_PROTOCOL_ERROR' : metadata.code !== 'INTERNAL' ? metadata.code : `PDF_${safeStage.toUpperCase()}_FAILED`;
  return { ...metadata, stage: safeStage, code };
}

async function render(input, options, markdown = false) {
  if (typeof input !== 'string' || input.length > 200000 || Buffer.byteLength(input, 'utf8') > 200000) throw campusError(422, 'RESUME_TOO_LONG', '简历内容过长，请精简后导出。');
  if (active) throw campusError(429, 'PDF_BUSY', '已有文件正在生成，请稍后重试。');
  active = true;
  let browser;
  let abort;
  const { signal, requestId } = options;
  let stage = 'sanitize';
  const enterStage = (next) => { stage = next; logEvent('pdf.stage', { requestId, stage }); };
  logEvent('pdf.started', { requestId });
  try {
    const html = sanitizeResumeHtml(markdown ? marked.parse(input) : input);
    if (Buffer.byteLength(html, 'utf8') > 200000) throw campusError(422, 'RESUME_TOO_LONG', '简历内容过长，请精简后导出。');
    if (signal?.aborted) throw campusError(499, 'REQUEST_ABORTED', '导出已取消。');
    enterStage('launch');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'], timeout: 30000 });
    abort = () => { void browser.close().catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) throw campusError(499, 'REQUEST_ABORTED', '导出已取消。');
    enterStage('page');
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setJavaScriptEnabled(false);
    const font = [process.env.CAMPUS_CJK_FONT, '/mnt/c/Windows/Fonts/msyh.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'].find((file) => file && existsSync(file) && statSync(file).size <= 32 * 1024 * 1024);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (font && request.url() === 'https://resume-font.invalid/cjk') void request.respond({ status: 200, contentType: 'font/ttf', body: readFileSync(font) }).catch(() => {});
      else void request.abort().catch(() => {});
    });
    const fontCss = font ? '@font-face{font-family:ResumeCJK;src:url("https://resume-font.invalid/cjk")}' : '';
    await page.emulateMediaType('print');
    enterStage('content');
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(options.title || '职芽简历')}</title><style>${fontCss}
      @page{size:A4;margin:15mm}html,body{margin:0;padding:0}body{font:11pt/1.5 ResumeCJK,"Microsoft YaHei","Noto Sans CJK SC",sans-serif;color:#222;overflow-wrap:anywhere}h1{font-size:20pt;text-align:center;margin:0 0 8pt}h2{font-size:13pt;color:#0f6e56;border-bottom:1px solid #bbb;margin:12pt 0 5pt}h3,h4{font-size:11pt;margin:8pt 0 3pt}p{margin:4pt 0}ul,ol{padding-left:20pt;margin:4pt 0}li{margin:2pt 0}pre{white-space:pre-wrap}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{padding:3pt;border:1px solid #ccc}*{orphans:1;widows:1}h1,h2,h3,h4{break-after:avoid}blockquote{margin:5pt 12pt}
    </style></head><body>${html}</body></html>`, { waitUntil: 'networkidle0', timeout: 30000 });
    enterStage('fonts');
    await page.evaluate(() => globalThis.document.fonts.ready);
    enterStage('print');
    const printed = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }, timeout: 30000 });
    // The bundled PDF.js mishandles Buffer and views into larger backing buffers.
    const data = !Buffer.isBuffer(printed) && printed.byteOffset === 0 && printed.byteLength === printed.buffer.byteLength ? printed : Uint8Array.from(printed);
    const bytes = Buffer.from(data.buffer);
    if (bytes.length > 5 * 1024 * 1024) throw campusError(422, 'PDF_TOO_LARGE', '生成文件过大，请精简后重试。');
    // Inspect actual printed text positions, not screen height: pagination can add whitespace.
    const pages = [];
    enterStage('parse');
    await pdfParse(data, { pagerender: async (pdfPage) => {
      const content = await pdfPage.getTextContent();
      pages[pdfPage.pageNumber - 1] = content.items.map((item) => ({ text: item.str || '', bottom: item.transform?.[5] ?? 0 }));
      return content.items.map((item) => item.str).join(' ');
    } });
    assertPdfLayout(pages);
    if (signal?.aborted) throw campusError(499, 'REQUEST_ABORTED', '导出已取消。');
    logEvent('pdf.completed', { requestId, bytes: bytes.length, count: pages.length });
    return bytes;
  } catch (error) {
    const failure = pdfFailureMetadata(error, stage);
    logEvent('pdf.failed', { requestId, ...failure });
    if (error.safeMessage) throw error;
    throw campusError(error.name === 'TimeoutError' ? 504 : 500, failure.code, 'PDF 生成暂时失败，请稍后重试并提供请求编号以便定位。');
  } finally {
    signal?.removeEventListener('abort', abort);
    if (browser) await browser.close().catch(() => {});
    active = false;
  }
}

export const generatePDF = (markdownText, options = {}) => render(markdownText, options, true);
export const generatePDFFromHTML = (htmlBody, options = {}) => render(htmlBody, options);
