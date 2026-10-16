import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WHITELISTED_FILES = [];

function getTemplateFiles(dir) {
  return fs.readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, entry.toString()))
    .filter((file) => {
      const ext = path.extname(file);
      return ext === '.jsx' || ext === '.tsx';
    });
}

describe('No dangerouslySetInnerHTML in portfolio templates', () => {
  test('scans all template files and checks for dangerouslySetInnerHTML', () => {
    const started = Date.now();
    const templatesDir = path.resolve(__dirname, '../components/portfolio/templates');
    const files = getTemplateFiles(templatesDir);
    expect(files.length, `No jsx/tsx files found under ${templatesDir}`).toBeGreaterThan(0);

    const violations = [];
    files.forEach((file) => {
      const relativePath = path.relative(templatesDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('dangerouslySetInnerHTML')) return;
      const isWhitelisted = WHITELISTED_FILES.some((whiteFile) => (
        relativePath === whiteFile || file.endsWith(whiteFile)
      ));
      if (!isWhitelisted) violations.push(relativePath);
    });

    const elapsedMs = Date.now() - started;
    expect(
      violations,
      [
        `dangerouslySetInnerHTML scan failed`,
        `root=${templatesDir}`,
        `files=${files.length}`,
        `elapsedMs=${elapsedMs}`,
        `violations=${violations.join(', ') || 'none'}`,
      ].join('; '),
    ).toEqual([]);
  }, 30000);
});
