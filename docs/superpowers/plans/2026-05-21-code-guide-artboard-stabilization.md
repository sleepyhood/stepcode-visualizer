# Code Guide Artboard Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 줌·스크롤·캡처 상태에서도 코드/콘솔/박스/화살표가 하나의 단일 아트보드 안에서 정확히 정렬되고, PNG 캡처가 잘리지 않도록 코드 가이드 비주얼라이저를 안정화한다.

**Architecture:** `GuideCanvas`를 “단일 아트보드 + 내부 오버레이 레이어” 구조로 재편한다. 앵커 좌표는 DOM 실측값을 아트보드 로컬 좌표로 변환하는 공용 유틸에서만 계산하고, 박스/화살표/캡처는 모두 같은 아트보드 경계 안에서만 렌더링한다. 수동 자유 드래그는 도입하지 않고, 자동 배치 + 소폭 수동 보정값(`offset`)만 허용한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Shiki, react-xarrows, html-to-image, node:test

---

## File Structure

**Create**
- `components/code-guide/canvas/layout-utils.ts`
- `components/code-guide/canvas/annotation-layer.tsx`
- `tests/layout-utils.test.mjs`
- `tests/export-frame.test.mjs`

**Modify**
- `components/code-guide/types.ts`
- `components/CodeGuideVisualizer.tsx`
- `components/code-guide/canvas/GuideCanvas.tsx`
- `components/code-guide/panels/ReviewPanel.tsx`
- `components/code-guide/panels/ExportPanel.tsx`
- `components/code-guide/annotation-utils.js`

**Responsibilities**
- `layout-utils.ts`: 아트보드 기준 좌표 변환, 오버레이 프레임 계산, 캡처 bounds 계산
- `annotation-layer.tsx`: 박스/화살표 렌더링 전용 레이어. 코드/콘솔 본문과 분리
- `types.ts`: 어노테이션 offset 타입 정의
- `GuideCanvas.tsx`: 단일 아트보드 DOM 구조, 앵커 측정, 레이어 조립
- `ReviewPanel.tsx`: offset 미세 보정 UI 추가
- `ExportPanel.tsx`: 아트보드 bounds 기반 안전 캡처
- `CodeGuideVisualizer.tsx`: offset 업데이트 상태 연결
- `annotation-utils.js`: 앵커 정규화 유지, offset 기본값과 함께 처리

---

### Task 1: Introduce Geometry Utilities And Regression Tests

**Files:**
- Create: `components/code-guide/canvas/layout-utils.ts`
- Test: `tests/layout-utils.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampToArtboard,
  getLocalPoint,
  getSafeExportFrame,
} from '../components/code-guide/canvas/layout-utils.js';

test('getLocalPoint converts viewport coordinates into artboard-local coordinates', () => {
  const point = getLocalPoint(
    { left: 100, top: 200 },
    { left: 340, top: 520 },
  );

  assert.deepEqual(point, { x: 240, y: 320 });
});

test('clampToArtboard keeps overlay box inside artboard width', () => {
  const next = clampToArtboard(
    { x: -30, y: 20, width: 220, height: 40 },
    { width: 700, height: 900, padding: 24 },
  );

  assert.deepEqual(next, { x: 24, y: 24, width: 220, height: 40 });
});

test('getSafeExportFrame expands export width to include left and right overlays', () => {
  const frame = getSafeExportFrame({
    artboard: { x: 48, y: 48, width: 700, height: 900 },
    overlays: [
      { x: -160, y: 120, width: 180, height: 40 },
      { x: 660, y: 300, width: 210, height: 48 },
    ],
    padding: 24,
  });

  assert.deepEqual(frame, {
    x: -136,
    y: 24,
    width: 918,
    height: 948,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/layout-utils.test.mjs`

Expected: FAIL with module-not-found for `layout-utils.js` or missing export errors.

- [ ] **Step 3: Write minimal implementation**

```ts
export type LocalPoint = { x: number; y: number };
export type LocalRect = { x: number; y: number; width: number; height: number };
export type ArtboardBounds = { width: number; height: number; padding: number };
export type ExportFrameInput = {
  artboard: LocalRect;
  overlays: LocalRect[];
  padding: number;
};

export function getLocalPoint(
  origin: { left: number; top: number },
  point: { left: number; top: number },
): LocalPoint {
  return {
    x: point.left - origin.left,
    y: point.top - origin.top,
  };
}

export function clampToArtboard(rect: LocalRect, artboard: ArtboardBounds): LocalRect {
  const min = artboard.padding;
  const maxX = Math.max(min, artboard.width - artboard.padding - rect.width);
  const maxY = Math.max(min, artboard.height - artboard.padding - rect.height);

  return {
    ...rect,
    x: Math.min(Math.max(rect.x, min), maxX),
    y: Math.min(Math.max(rect.y, min), maxY),
  };
}

export function getSafeExportFrame(input: ExportFrameInput): LocalRect {
  const all = [input.artboard, ...input.overlays];
  const left = Math.min(...all.map((item) => item.x)) - input.padding;
  const top = Math.min(...all.map((item) => item.y)) - input.padding;
  const right = Math.max(...all.map((item) => item.x + item.width)) + input.padding;
  const bottom = Math.max(...all.map((item) => item.y + item.height)) + input.padding;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/layout-utils.test.mjs`

Expected: PASS for all three cases.

- [ ] **Step 5: Commit**

```bash
git add components/code-guide/canvas/layout-utils.ts tests/layout-utils.test.mjs
git commit -m "test: add artboard geometry regression coverage"
```

### Task 2: Move All Overlays Into A Single Artboard Coordinate System

**Files:**
- Create: `components/code-guide/canvas/annotation-layer.tsx`
- Modify: `components/code-guide/canvas/GuideCanvas.tsx`
- Modify: `components/code-guide/types.ts`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { getSafeExportFrame } from '../components/code-guide/canvas/layout-utils.js';

test('export frame width stays wider than artboard when a label protrudes left', () => {
  const frame = getSafeExportFrame({
    artboard: { x: 0, y: 0, width: 700, height: 900 },
    overlays: [{ x: -220, y: 80, width: 260, height: 44 }],
    padding: 24,
  });

  assert.equal(frame.width > 700, true);
  assert.equal(frame.x < 0, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/layout-utils.test.mjs`

Expected: FAIL until Task 1 implementation exists and `getSafeExportFrame` is imported correctly.

- [ ] **Step 3: Extend annotation types for explicit offset support**

```ts
export interface AnnotationOffset {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  visible: boolean;
  color: AnnotationColor;
  comment?: string;
  from: AnnotationAnchor;
  to?: AnnotationAnchor;
  boxOffset?: AnnotationOffset;
  labelOffset?: AnnotationOffset;
}
```

- [ ] **Step 4: Build a dedicated annotation layer**

```tsx
interface MeasuredAnnotation {
  id: string;
  type: 'box' | 'arrow';
  color: string;
  comment?: string;
  fromPoint: { x: number; y: number };
  toPoint?: { x: number; y: number };
  boxRect?: { x: number; y: number; width: number; height: number };
  labelRect?: { x: number; y: number; width: number; height: number };
}

export default function AnnotationLayer({
  annotations,
  measured,
}: {
  annotations: Annotation[];
  measured: Record<string, MeasuredAnnotation>;
}) {
  return (
    <>
      {annotations.map((annotation) => {
        const item = measured[annotation.id];
        if (!item || !annotation.visible) return null;
        return annotation.type === 'box'
          ? <BoxBubble key={annotation.id} annotation={annotation} measured={item} />
          : <ArrowBubble key={annotation.id} annotation={annotation} measured={item} />;
      })}
    </>
  );
}
```

- [ ] **Step 5: Rebuild `GuideCanvas` around one artboard**

```tsx
<section id="guide-preview-container" className="flex-1 overflow-auto bg-neutral-300">
  <div className="mx-auto p-12">
    <div
      id="capture-target"
      className="relative"
      style={{ width: exportFrame.width, height: exportFrame.height }}
    >
      <div
        id="guide-artboard"
        className="absolute bg-[#e5e5e5] rounded-xl shadow-sm"
        style={{
          left: artboardOrigin.x,
          top: artboardOrigin.y,
          width: 700,
          transform: `scale(${isExporting ? 1 : zoomScale})`,
          transformOrigin: 'top left',
        }}
      >
        <div id="guide-canvas-content" className="relative flex flex-col gap-6 p-6">
          {codeAndConsole}
        </div>
      </div>

      <div
        id="annotation-overlay-layer"
        className="absolute inset-0 pointer-events-none"
      >
        <AnnotationLayer annotations={annotations} measured={measuredAnnotations} />
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 6: Measure anchors against `guide-canvas-content`, not `capture-target`**

```ts
const contentRect = contentEl.getBoundingClientRect();
const anchorRect = anchorEl.getBoundingClientRect();
const fromPoint = getLocalPoint(contentRect, {
  left: anchorRect.left + anchorRect.width / 2,
  top: anchorRect.top + anchorRect.height / 2,
});
```

- [ ] **Step 7: Remove old absolute box placement logic**

Delete the `BoxAnnotation` component inside `GuideCanvas.tsx` and replace it with measured box rectangles produced from `layout-utils.ts`.

- [ ] **Step 8: Run typecheck and tests**

Run:
- `node --test tests/layout-utils.test.mjs`
- `npx tsc --noEmit`

Expected:
- node tests PASS
- TypeScript PASS

- [ ] **Step 9: Commit**

```bash
git add components/code-guide/types.ts components/code-guide/canvas/layout-utils.ts components/code-guide/canvas/annotation-layer.tsx components/code-guide/canvas/GuideCanvas.tsx tests/layout-utils.test.mjs
git commit -m "feat: unify code guide overlays into single artboard"
```

### Task 3: Replace Free-Position Drift With Deterministic Auto-Layout Plus Small Offsets

**Files:**
- Modify: `components/CodeGuideVisualizer.tsx`
- Modify: `components/code-guide/panels/ReviewPanel.tsx`
- Modify: `components/code-guide/annotation-utils.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAnnotations } from '../components/code-guide/annotation-utils.js';

test('normalizeAnnotations preserves explicit overlay offsets', () => {
  const [annotation] = normalizeAnnotations('int main() {}', '', [{
    id: 'anno-1',
    type: 'box',
    visible: true,
    color: 'yellow',
    comment: 'demo',
    from: { target: 'code', line: 1, text: 'int' },
    boxOffset: { x: -48, y: 12 },
    labelOffset: { x: 16, y: -8 },
  }]);

  assert.deepEqual(annotation.boxOffset, { x: -48, y: 12 });
  assert.deepEqual(annotation.labelOffset, { x: 16, y: -8 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/layout-utils.test.mjs tests/export-frame.test.mjs`

Expected: FAIL because offset fields are currently dropped or undefined.

- [ ] **Step 3: Keep offset fields intact during normalization**

```js
export function normalizeAnnotations(sourceCode, consoleOutput, annotations) {
  return annotations.map((annotation) => ({
    ...annotation,
    boxOffset: annotation.boxOffset ?? { x: 0, y: 0 },
    labelOffset: annotation.labelOffset ?? { x: 0, y: 0 },
    from: normalizeAnchor(sourceCode, consoleOutput, annotation.from),
    to: annotation.to ? normalizeAnchor(sourceCode, consoleOutput, annotation.to) : annotation.to,
  }));
}
```

- [ ] **Step 4: Add update handlers in `CodeGuideVisualizer.tsx`**

```ts
const handleUpdateOffset = useCallback((
  id: string,
  key: 'boxOffset' | 'labelOffset',
  axis: 'x' | 'y',
  value: number,
) => {
  setAnnotations((prev) => prev.map((item) => {
    if (item.id !== id) return item;
    const current = item[key] ?? { x: 0, y: 0 };
    return {
      ...item,
      [key]: {
        ...current,
        [axis]: value,
      },
    };
  }));
}, []);
```

- [ ] **Step 5: Add micro-adjust UI in `ReviewPanel.tsx`**

```tsx
<div className="grid grid-cols-2 gap-1 mt-2 pl-7">
  <label className="text-[10px] text-neutral-500">
    박스 X
    <input
      type="number"
      value={anno.boxOffset?.x ?? 0}
      onChange={(e) => onUpdateOffset(anno.id, 'boxOffset', 'x', Number(e.target.value))}
      className="mt-1 w-full rounded border border-neutral-200 px-1.5 py-1"
    />
  </label>
  <label className="text-[10px] text-neutral-500">
    박스 Y
    <input
      type="number"
      value={anno.boxOffset?.y ?? 0}
      onChange={(e) => onUpdateOffset(anno.id, 'boxOffset', 'y', Number(e.target.value))}
      className="mt-1 w-full rounded border border-neutral-200 px-1.5 py-1"
    />
  </label>
</div>
```

- [ ] **Step 6: Explicitly reject free drag in code comments and plan notes**

Add this comment near the offset handlers:

```ts
// Free drag is intentionally not supported.
// We keep overlay placement deterministic and capture-safe by storing small numeric offsets only.
```

- [ ] **Step 7: Run regression checks**

Run:
- `node --test tests/layout-utils.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add components/CodeGuideVisualizer.tsx components/code-guide/panels/ReviewPanel.tsx components/code-guide/annotation-utils.js components/code-guide/types.ts
git commit -m "feat: add deterministic overlay offset controls"
```

### Task 4: Make Export Use Measured Frame Instead Of Raw DOM Box

**Files:**
- Create: `tests/export-frame.test.mjs`
- Modify: `components/code-guide/panels/ExportPanel.tsx`
- Modify: `components/code-guide/canvas/GuideCanvas.tsx`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { getSafeExportFrame } from '../components/code-guide/canvas/layout-utils.js';

test('left-side labels are included in export frame', () => {
  const frame = getSafeExportFrame({
    artboard: { x: 0, y: 0, width: 700, height: 860 },
    overlays: [
      { x: -240, y: 40, width: 280, height: 44 },
      { x: -200, y: 320, width: 240, height: 44 },
    ],
    padding: 32,
  });

  assert.equal(frame.x, -272);
  assert.equal(frame.width, 1004);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/export-frame.test.mjs`

Expected: FAIL until export frame math is wired up.

- [ ] **Step 3: Publish export frame dimensions from `GuideCanvas`**

```ts
interface GuideCanvasProps {
  ...
  onExportFrameChange?: (frame: { width: number; height: number; x: number; y: number }) => void;
}

useEffect(() => {
  onExportFrameChange?.(exportFrame);
}, [exportFrame, onExportFrameChange]);
```

- [ ] **Step 4: Store export frame in `CodeGuideVisualizer.tsx` and pass it down**

```ts
const [exportFrame, setExportFrame] = useState({ x: 0, y: 0, width: 796, height: 980 });
...
<GuideCanvas ... onExportFrameChange={setExportFrame} />
<ExportPanel ... exportFrame={exportFrame} />
```

- [ ] **Step 5: Use explicit width/height/style overrides during PNG export**

```ts
const options = await buildCaptureOptions(node);
const url = await toPng(node, {
  ...options,
  width: exportFrame.width,
  height: exportFrame.height,
  style: {
    width: `${exportFrame.width}px`,
    height: `${exportFrame.height}px`,
  },
});
```

- [ ] **Step 6: Shift artboard origin so negative overlay coordinates remain visible**

```ts
const artboardOrigin = {
  x: exportFrame.x < 0 ? Math.abs(exportFrame.x) : 0,
  y: exportFrame.y < 0 ? Math.abs(exportFrame.y) : 0,
};
```

- [ ] **Step 7: Run verification**

Run:
- `node --test tests/layout-utils.test.mjs tests/export-frame.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add components/CodeGuideVisualizer.tsx components/code-guide/canvas/GuideCanvas.tsx components/code-guide/panels/ExportPanel.tsx tests/export-frame.test.mjs
git commit -m "fix: capture full code guide artboard without clipping"
```

### Task 5: Final Verification With The Provided Beginner C Sample

**Files:**
- Modify: none
- Test: manual verification using current UI and provided JSON

- [ ] **Step 1: Load the provided JSON fixture into the app**

Use the user-provided annotation JSON with the default C sample currently in `components/code-guide/types.ts`.

- [ ] **Step 2: Verify anchor behavior at multiple zoom levels**

Manual checks:
- 50% zoom: blue arrow tail remains centered on console `A`
- 100% zoom: red arrow head remains centered on `Result:`
- 150% zoom: yellow and green boxes stay attached to their target tokens

- [ ] **Step 3: Verify offset controls**

Manual checks:
- Change `boxOffset.x` from `0` to `-40`
- Confirm the box moves left, but anchor target remains unchanged
- Reset to `0`

- [ ] **Step 4: Verify export frame**

Manual checks:
- Export PNG
- Confirm left-side labels are fully visible
- Confirm code panel right edge is not clipped
- Confirm arrow labels are inside the PNG bounds

- [ ] **Step 5: Run final automated checks**

Run:
- `node --test tests/layout-utils.test.mjs tests/export-frame.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`

Expected:
- all tests PASS
- no TypeScript errors
- no ESLint warnings

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify stabilized code guide artboard"
```

---

## Self-Review

**Spec coverage**
- 단일 아트보드 구조: Task 2
- 박스/화살표 좌표 안정화: Task 2
- 자유 드래그 배제 및 대체 수단: Task 3
- 캡처 잘림 원인 제거: Task 4
- 실제 샘플 검증: Task 5

**Placeholder scan**
- `TODO`, `TBD`, “적절히”, “나중에” 같은 표현 없음
- 각 작업에 파일 경로, 명령어, 코드 스니펫 포함

**Type consistency**
- `boxOffset`, `labelOffset`, `onExportFrameChange`, `getSafeExportFrame` 명칭 전 구간 통일

---

Plan complete and saved to `docs/superpowers/plans/2026-05-21-code-guide-artboard-stabilization.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
