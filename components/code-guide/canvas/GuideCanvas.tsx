'use client';

import { useEffect, useMemo } from 'react';
import { Terminal } from 'lucide-react';
import { createHighlighter, type HighlighterCore } from 'shiki';
import Xarrow, { Xwrapper, useXarrow } from 'react-xarrows';
import { Annotation, TargetLang, COLOR_HEX } from '../types';

interface GuideCanvasProps {
    sourceCode: string;
    consoleOutput: string;
    language: TargetLang;
    annotations: Annotation[];
    highlighter: HighlighterCore | null;
    zoomScale: number;
    isExporting: boolean;
    anchorElements: Record<string, HTMLElement>;
    onScroll: () => void;
}

export default function GuideCanvas({
    sourceCode,
    consoleOutput,
    language,
    annotations,
    highlighter,
    zoomScale,
    isExporting,
    anchorElements,
    onScroll,
}: GuideCanvasProps) {
    const updateXarrow = useXarrow();

    // Shiki HTML 렌더링
    const htmlOutput = useMemo(() => {
        if (!highlighter || !sourceCode.trim()) return '';
        return highlighter.codeToHtml(sourceCode, {
            lang: language,
            theme: 'one-dark-pro',
            transformers: [
                {
                    line(node, line) {
                        node.properties['data-line'] = line;
                        node.properties['data-lang'] = language;
                        node.properties['data-target'] = 'code';
                    },
                    span(node) {
                        const textNode = node.children[0];
                        if (textNode && textNode.type === 'text') {
                            node.properties['data-token-text'] = (textNode as { value: string }).value.trim();
                        }
                    },
                },
            ],
        });
    }, [sourceCode, language, highlighter]);

    // 줌/스크롤 시 화살표 재계산
    useEffect(() => {
        updateXarrow();
    }, [zoomScale, htmlOutput, consoleOutput, annotations]);

    // 콘솔 줄 렌더링 — 공백 분리 토큰에 data-target 속성 주입
    const renderConsoleLines = () =>
        consoleOutput.split('\n').map((line, i) => (
            <div key={i} data-target="console" data-line={i + 1} className="min-h-[1.5rem]">
                {line.split(/(\s+)/).map((word, j) => {
                    if (word.trim() === '') return <span key={j}>{word}</span>;
                    return (
                        <span key={j} data-target="console" data-line={i + 1} data-token-text={word}>
                            {word}
                        </span>
                    );
                })}
            </div>
        ));

    return (
        <section
            id="guide-preview-container"
            className="flex-1 bg-neutral-300 overflow-auto relative flex"
            onScroll={onScroll}
        >
            <div
                className="m-auto p-12 transition-all duration-75 relative origin-center"
                style={{ transform: `scale(${isExporting ? 1 : zoomScale})` }}
            >
                <Xwrapper>
                    <div
                        id="capture-target"
                        className="flex flex-col gap-6 bg-[#e5e5e5] p-6 rounded-xl shadow-sm relative"
                        style={{ width: '700px' }}
                    >
                        {/* 코드 블록 */}
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

                        {/* 콘솔 블록 */}
                        <div className="rounded-xl overflow-hidden shadow-md bg-[#1e1e1e] border border-neutral-700">
                            <div className="flex items-center px-4 py-2 bg-black/40 text-neutral-400 text-xs font-mono gap-2">
                                <Terminal className="w-3 h-3" /> Output Console
                            </div>
                            <div className="p-4 font-mono text-sm text-neutral-300">
                                {renderConsoleLines()}
                            </div>
                        </div>

                        {/* 어노테이션 렌더링 */}
                        {annotations.filter(a => a.visible).map(anno => {
                            const fromId = `anchor-${anno.id}-from`;
                            const toId = `anchor-${anno.id}-to`;
                            const color = COLOR_HEX[anno.color];

                            if (anno.type === 'box') {
                                const el = anchorElements[fromId];
                                if (!el) return null;
                                return (
                                    <div key={anno.id}>
                                        <Xarrow
                                            start={fromId} end={fromId}
                                            showHead={false} color="transparent" strokeWidth={0}
                                            labels={anno.comment ? {
                                                end: (
                                                    <div
                                                        className="text-xs font-sans px-2 py-1 rounded shadow text-white font-bold max-w-[200px]"
                                                        style={{ backgroundColor: color, transform: 'translateY(-20px)' }}
                                                    >
                                                        {anno.comment}
                                                    </div>
                                                )
                                            } : undefined}
                                        />
                                    </div>
                                );
                            }

                            if (anno.type === 'arrow' && anno.to) {
                                return (
                                    <Xarrow
                                        key={anno.id}
                                        start={fromId}
                                        end={toId}
                                        color={color}
                                        strokeWidth={3}
                                        headSize={5}
                                        path="smooth"
                                        curveness={0.8}
                                        dashness={true}
                                        labels={anno.comment ? {
                                            middle: (
                                                <div className="text-xs font-sans px-2 py-0.5 rounded shadow text-white font-bold bg-neutral-800/90">
                                                    {anno.comment}
                                                </div>
                                            )
                                        } : undefined}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                </Xwrapper>
            </div>
        </section>
    );
}
