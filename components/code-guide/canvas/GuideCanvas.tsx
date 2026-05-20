'use client';

import { useEffect, useMemo, useState } from 'react';
import { Terminal } from 'lucide-react';
import { type HighlighterCore } from 'shiki';
import { type Annotation, type AnnotationOffset, type TargetLang } from '../types';
import { doesAnchorMatchToken } from '../annotation-utils';
import AnnotationLayer, {
    type AnchorRect,
    type ArrowOverlayData,
    type ArtboardOverlayData,
    type BoxOverlayData,
} from './annotation-layer';
import { getLocalPoint } from './layout-utils';

interface GuideCanvasProps {
    sourceCode: string;
    consoleOutput: string;
    language: TargetLang;
    annotations: Annotation[];
    highlighter: HighlighterCore | null;
    zoomScale: number;
    isExporting: boolean;
}

interface OverlayLayoutState {
    arrowOverlays: ArrowOverlayData[];
    artboard: ArtboardOverlayData;
    boxOverlays: BoxOverlayData[];
}

const DEFAULT_ARTBOARD_WIDTH = 700;
const DEFAULT_BOX_OFFSET: AnnotationOffset = { x: 0, y: -28 };
const DEFAULT_LABEL_OFFSET: AnnotationOffset = { x: 0, y: 0 };

function getScaleFactor(contentEl: HTMLElement, rect: DOMRect) {
    return {
        x: contentEl.offsetWidth ? rect.width / contentEl.offsetWidth : 1,
        y: contentEl.offsetHeight ? rect.height / contentEl.offsetHeight : 1,
    };
}

function measureAnchor(contentEl: HTMLElement, anchorId: string): AnchorRect | null {
    const anchorEl = document.getElementById(anchorId);
    if (!anchorEl) return null;

    const contentRect = contentEl.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const scale = getScaleFactor(contentEl, contentRect);
    const localPoint = getLocalPoint(
        { left: contentRect.left, top: contentRect.top },
        { left: anchorRect.left, top: anchorRect.top },
    );
    const width = anchorRect.width / scale.x;
    const height = anchorRect.height / scale.y;
    const x = localPoint.x / scale.x;
    const y = localPoint.y / scale.y;

    return {
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2,
    };
}

function buildArrowGeometry(from: AnchorRect, to: AnchorRect) {
    const dx = to.centerX - from.centerX;
    const dy = to.centerY - from.centerY;
    const horizontalBias = Math.abs(dx) >= Math.abs(dy);

    let c1x = from.centerX;
    let c1y = from.centerY;
    let c2x = to.centerX;
    let c2y = to.centerY;

    if (horizontalBias) {
        const curve = Math.min(120, Math.max(48, Math.abs(dx) * 0.35));
        c1x += Math.sign(dx || 1) * curve;
        c2x -= Math.sign(dx || 1) * curve;
    } else {
        const curve = Math.min(120, Math.max(48, Math.abs(dy) * 0.35));
        c1y += Math.sign(dy || 1) * curve;
        c2y -= Math.sign(dy || 1) * curve;
    }

    const midpoint = cubicBezierPoint(
        { x: from.centerX, y: from.centerY },
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
        { x: to.centerX, y: to.centerY },
        0.5,
    );

    return {
        midpoint,
        path: `M ${from.centerX} ${from.centerY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.centerX} ${to.centerY}`,
    };
}

function cubicBezierPoint(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number,
) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return {
        x: (mt2 * mt * p0.x) + (3 * mt2 * t * p1.x) + (3 * mt * t2 * p2.x) + (t2 * t * p3.x),
        y: (mt2 * mt * p0.y) + (3 * mt2 * t * p1.y) + (3 * mt * t2 * p2.y) + (t2 * t * p3.y),
    };
}

function getMarkerId(annotationId: string, color: string): string {
    return `annotation-arrow-${color}-${annotationId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getOffset(offset: AnnotationOffset | undefined, fallback: AnnotationOffset) {
    return {
        x: offset?.x ?? fallback.x,
        y: offset?.y ?? fallback.y,
    };
}

function isPresent<T>(value: T | null): value is T {
    return value !== null;
}

export default function GuideCanvas({
    sourceCode,
    consoleOutput,
    language,
    annotations,
    highlighter,
    zoomScale,
    isExporting,
}: GuideCanvasProps) {
    const [overlayLayout, setOverlayLayout] = useState<OverlayLayoutState>({
        artboard: {
            width: DEFAULT_ARTBOARD_WIDTH,
            height: 0,
        },
        boxOverlays: [],
        arrowOverlays: [],
    });

    const htmlOutput = useMemo(() => {
        if (!highlighter || !sourceCode.trim()) return '';

        let currentLine = 0;
        const assignedIds = new Set<string>();
        const wordOccurrencesInLine: Record<number, Record<string, number>> = {};

        return highlighter.codeToHtml(sourceCode, {
            lang: language,
            theme: 'one-dark-pro',
            transformers: [
                {
                    line(node, line) {
                        currentLine = line;
                        node.properties['data-line'] = line;
                        node.properties['data-lang'] = language;
                        node.properties['data-target'] = 'code';
                    },
                    span(node) {
                        const textNode = node.children[0];
                        if (textNode && textNode.type === 'text') {
                            const tokenText = (textNode as { value: string }).value.trim();
                            if (!tokenText) return;

                            if (!wordOccurrencesInLine[currentLine]) {
                                wordOccurrencesInLine[currentLine] = {};
                            }

                            const currentCount = wordOccurrencesInLine[currentLine][tokenText] || 0;
                            wordOccurrencesInLine[currentLine][tokenText] = currentCount + 1;
                            const occurrenceIdx = currentCount;

                            node.properties['data-token-text'] = tokenText;

                            annotations.forEach((annotation) => {
                                if (!annotation.visible) return;

                                const fromId = `anchor-${annotation.id}-from`;
                                if (
                                    !assignedIds.has(fromId) &&
                                    annotation.from.target === 'code' &&
                                    doesAnchorMatchToken(annotation.from, currentLine, tokenText, occurrenceIdx)
                                ) {
                                    node.properties.id = fromId;
                                    assignedIds.add(fromId);
                                }

                                if (annotation.to?.target === 'code') {
                                    const toId = `anchor-${annotation.id}-to`;
                                    if (
                                        !assignedIds.has(toId) &&
                                        doesAnchorMatchToken(annotation.to, currentLine, tokenText, occurrenceIdx)
                                    ) {
                                        node.properties.id = toId;
                                        assignedIds.add(toId);
                                    }
                                }
                            });
                        }
                    },
                },
            ],
        });
    }, [annotations, highlighter, language, sourceCode]);

    useEffect(() => {
        const artboardEl = document.getElementById('guide-artboard');
        const contentEl = document.getElementById('guide-canvas-content');
        if (!artboardEl || !contentEl) {
            setOverlayLayout((current) => ({
                ...current,
                boxOverlays: [],
                arrowOverlays: [],
            }));
            return;
        }

        let frameId = 0;

        const measure = () => {
            const nextArtboard = {
                width: artboardEl.offsetWidth || DEFAULT_ARTBOARD_WIDTH,
                height: artboardEl.offsetHeight,
            };

            const boxOverlays = annotations
                .filter((annotation) => annotation.visible && annotation.type === 'box' && annotation.comment)
                .map((annotation, index): BoxOverlayData | null => {
                    const anchor = measureAnchor(contentEl, `anchor-${annotation.id}-from`);
                    if (!anchor) return null;

                    const offset = getOffset(annotation.boxOffset, DEFAULT_BOX_OFFSET);

                    return {
                        id: annotation.id,
                        color: annotation.color,
                        comment: annotation.comment,
                        index,
                        position: {
                            x: anchor.x + offset.x,
                            y: anchor.y + offset.y,
                        },
                    };
                })
                .filter(isPresent);

            const arrowOverlays = annotations
                .filter((annotation) => annotation.visible && annotation.type === 'arrow' && annotation.to)
                .map((annotation, index): ArrowOverlayData | null => {
                    const from = measureAnchor(contentEl, `anchor-${annotation.id}-from`);
                    const to = measureAnchor(contentEl, `anchor-${annotation.id}-to`);
                    if (!from || !to) return null;

                    const geometry = buildArrowGeometry(from, to);
                    const offset = getOffset(annotation.labelOffset, DEFAULT_LABEL_OFFSET);

                    return {
                        id: annotation.id,
                        color: annotation.color,
                        comment: annotation.comment,
                        index,
                        labelPosition: {
                            x: geometry.midpoint.x + offset.x,
                            y: geometry.midpoint.y + offset.y,
                        },
                        markerId: getMarkerId(annotation.id, annotation.color),
                        path: geometry.path,
                    };
                })
                .filter(isPresent);

            setOverlayLayout({
                artboard: nextArtboard,
                boxOverlays,
                arrowOverlays,
            });
        };

        const scheduleMeasure = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(measure);
        };

        scheduleMeasure();

        const resizeObserver = new ResizeObserver(scheduleMeasure);
        resizeObserver.observe(artboardEl);
        resizeObserver.observe(contentEl);
        window.addEventListener('resize', scheduleMeasure);

        return () => {
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
        };
    }, [annotations, consoleOutput, htmlOutput, isExporting, zoomScale]);

    const renderConsoleLines = () => {
        const assignedIds = new Set<string>();

        return consoleOutput.split('\n').map((line, i) => {
            const currentLineNum = i + 1;
            const wordCounts: Record<string, number> = {};

            return (
                <div key={i} data-target="console" data-line={currentLineNum} className="min-h-[1.5rem]">
                    {line.split(/(\s+)/).map((word, j) => {
                        if (word.trim() === '') return <span key={j}>{word}</span>;

                        const tokenText = word.trim();
                        const currentCount = wordCounts[tokenText] || 0;
                        wordCounts[tokenText] = currentCount + 1;
                        const occurrenceIdx = currentCount;

                        let idProp: string | undefined;

                        annotations.forEach((annotation) => {
                            if (!annotation.visible) return;

                            const fromId = `anchor-${annotation.id}-from`;
                            if (
                                !assignedIds.has(fromId) &&
                                annotation.from.target === 'console' &&
                                doesAnchorMatchToken(annotation.from, currentLineNum, tokenText, occurrenceIdx)
                            ) {
                                idProp = fromId;
                                assignedIds.add(fromId);
                            }

                            if (annotation.to?.target === 'console') {
                                const toId = `anchor-${annotation.id}-to`;
                                if (
                                    !assignedIds.has(toId) &&
                                    doesAnchorMatchToken(annotation.to, currentLineNum, tokenText, occurrenceIdx)
                                ) {
                                    idProp = toId;
                                    assignedIds.add(toId);
                                }
                            }
                        });

                        return (
                            <span key={j} id={idProp} data-target="console" data-line={currentLineNum} data-token-text={tokenText}>
                                {word}
                            </span>
                        );
                    })}
                </div>
            );
        });
    };

    const effectiveScale = isExporting ? 1 : zoomScale;
    const scaledFrameHeight = overlayLayout.artboard.height > 0
        ? overlayLayout.artboard.height * effectiveScale
        : undefined;

    return (
        <section
            id="guide-preview-container"
            className="flex-1 bg-neutral-300 overflow-auto relative flex"
        >
            <div
                id="capture-target"
                className="m-auto p-12 relative"
            >
                <div
                    id="guide-canvas-frame"
                    className="relative"
                    style={{
                        width: overlayLayout.artboard.width * effectiveScale,
                        height: scaledFrameHeight,
                    }}
                >
                    <div
                        id="guide-canvas-scaled"
                        className="relative"
                        style={{
                            width: overlayLayout.artboard.width,
                            height: overlayLayout.artboard.height || 'auto',
                            transform: `scale(${effectiveScale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <div
                            id="guide-artboard"
                            className="relative"
                            style={{ width: overlayLayout.artboard.width }}
                        >
                            <div
                                id="guide-canvas-content"
                                className="flex flex-col gap-6 bg-[#e5e5e5] p-6 rounded-xl shadow-sm relative"
                                style={{ width: `${DEFAULT_ARTBOARD_WIDTH}px` }}
                            >
                                <div className="bg-[#24292e] text-white p-5 rounded-xl font-mono text-sm shadow-md">
                                    <div className="text-xs opacity-40 border-b border-white/10 pb-2 mb-3">
                                        {language === 'c' ? 'main.c' : language === 'cpp' ? 'main.cpp' : language === 'python' ? 'main.py' : 'Main.java'}
                                    </div>
                                    {!highlighter ? (
                                        <div className="text-neutral-500 animate-pulse">Loading Shiki...</div>
                                    ) : (
                                        <div
                                            className="leading-relaxed [&>pre]:!bg-transparent [&>pre]:m-0 [&>pre]:p-0 [&_code]:[counter-reset:step] [&_.line::before]:content-[counter(step)] [&_.line::before]:[counter-increment:step] [&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-8 [&_.line::before]:text-right [&_.line::before]:opacity-50"
                                            dangerouslySetInnerHTML={{ __html: htmlOutput }}
                                        />
                                    )}
                                </div>

                                <div className="rounded-xl overflow-hidden shadow-md bg-[#1e1e1e] border border-neutral-700">
                                    <div className="flex items-center px-4 py-2 bg-black/40 text-neutral-400 text-xs font-mono gap-2">
                                        <Terminal className="w-3 h-3" /> Output Console
                                    </div>
                                    <div className="p-4 font-mono text-sm text-neutral-300">
                                        {renderConsoleLines()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <AnnotationLayer
                            artboard={overlayLayout.artboard}
                            boxOverlays={overlayLayout.boxOverlays}
                            arrowOverlays={overlayLayout.arrowOverlays}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
