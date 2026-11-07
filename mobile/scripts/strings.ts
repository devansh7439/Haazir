/// <reference types="bun" />
// Lists every English text the app shows through t() or phrase(), with the Hindi recorded for it, as a CSV for the
// Federation's translators. Usage (from apps/mobile): bun run strings > strings.csv
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HINDI } from '../src/lib/i18n/hindi';

const SKIPPED_DIRECTORIES = new Set(['i18n']);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIPPED_DIRECTORIES.has(name) ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

/** Each English text and the files it appears in, in the order first met. */
export function collectStrings(srcDir: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(srcDir)) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 't' || node.expression.text === 'phrase')
      ) {
        const first = node.arguments[0];
        if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
          const where = relative(srcDir, file).replace(/\\/g, '/');
          const files = found.get(first.text) ?? [];
          if (!files.includes(where)) files.push(where);
          found.set(first.text, files);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return found;
}

const csvField = (value: string) => `"${value.replace(/"/g, '""')}"`;

if (import.meta.main) {
  const strings = collectStrings(join(import.meta.dir, '..', 'src'));
  const rows = [...strings].map(([english, where]) => [english, HINDI[english] ?? '', where.join(' ')].map(csvField).join(','));
  process.stdout.write(['english,hindi,where', ...rows].join('\n') + '\n');
}
