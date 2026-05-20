import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadLayoutUtils() {
  const sourcePath = new URL(
    '../components/code-guide/canvas/layout-utils.ts',
    import.meta.url,
  );
  const source = await readFile(sourcePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath.pathname,
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'layout-utils-test-'));
  const tempModulePath = path.join(tempDir, 'layout-utils.mjs');

  await writeFile(tempModulePath, outputText, 'utf8');

  try {
    return await import(pathToFileURL(tempModulePath).href);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('getLocalPoint converts viewport coordinates into artboard-local coordinates', async () => {
  const { getLocalPoint } = await loadLayoutUtils();
  const point = getLocalPoint(
    { left: 100, top: 200 },
    { left: 340, top: 520 },
  );

  assert.deepEqual(point, { x: 240, y: 320 });
});

test('clampToArtboard keeps overlay box inside artboard width', async () => {
  const { clampToArtboard } = await loadLayoutUtils();
  const next = clampToArtboard(
    { x: -30, y: 20, width: 220, height: 40 },
    { width: 700, height: 900, padding: 24 },
  );

  assert.deepEqual(next, { x: 24, y: 24, width: 220, height: 40 });
});

test('clampToArtboard shrinks oversized rects to fit inside padded artboard', async () => {
  const { clampToArtboard } = await loadLayoutUtils();
  const next = clampToArtboard(
    { x: -50, y: -40, width: 200, height: 120 },
    { width: 180, height: 100, padding: 24 },
  );

  assert.deepEqual(next, { x: 24, y: 24, width: 132, height: 52 });
});

test('getSafeExportFrame expands export width to include left and right overlays', async () => {
  const { getSafeExportFrame } = await loadLayoutUtils();
  const frame = getSafeExportFrame({
    artboard: { x: 48, y: 48, width: 700, height: 900 },
    overlays: [
      { x: -160, y: 120, width: 180, height: 40 },
      { x: 660, y: 300, width: 210, height: 48 },
    ],
    padding: 24,
  });

  assert.deepEqual(frame, {
    x: -184,
    y: 24,
    width: 1078,
    height: 948,
  });
});
