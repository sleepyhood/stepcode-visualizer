'use client';

import { useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { createHighlighter, type HighlighterCore } from 'shiki';
import { useXarrow } from 'react-xarrows';

// 타입 & 유틸
import {
    Annotation,
    TargetLang,
    Step,
    DEFAULT_SOURCE_CODE,
    DEFAULT_CONSOLE_OUTPUT,
} from './code-guide/types';
import { buildPrompt } from './code-guide/buildPrompt';

// 패널
import StepIndicator from './code-guide/panels/StepIndicator';
import InputPanel from './code-guide/panels/InputPanel';
import GeneratePanel from './code-guide/panels/GeneratePanel';
import ReviewPanel from './code-guide/panels/ReviewPanel';
import ExportPanel from './code-guide/panels/ExportPanel';

// 캔버스
import GuideCanvas from './code-guide/canvas/GuideCanvas';

export default function CodeGuideVisualizer() {
    // --- 입력 상태 ---
    const [sourceCode, setSourceCode] = useState<string>(DEFAULT_SOURCE_CODE);
    const [consoleOutput, setConsoleOutput] = useState<string>(DEFAULT_CONSOLE_OUTPUT);
    const [language, setLanguage] = useState<TargetLang>('c');

    // --- 단계 제어 ---
    const [activeStep, setActiveStep] = useState<Step>(1);
    const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

    // --- 어노테이션 ---
    const [annotations, setAnnotations] = useState<Annotation[]>([]);

    // --- 캔버스 ---
    const [zoomScale, setZoomScale] = useState<number>(1);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [anchorElements, setAnchorElements] = useState<Record<string, HTMLElement>>({});

    // --- Shiki 초기화 ---
    const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
    useEffect(() => {
        createHighlighter({
            themes: ['one-dark-pro'],
            langs: ['c', 'cpp', 'python', 'java'],
        }).then(setHighlighter);
    }, []);

    const updateXarrow = useXarrow();

    // --- DOM ID 매핑 (앵커 추적) ---
    useEffect(() => {
        const mapping: Record<string, HTMLElement> = {};
        const getElement = (target: string, lang?: string, line?: number, text?: string) => {
            if (target === 'console') {
                return Array.from(document.querySelectorAll(
                    `[data-target="console"][data-token-text="${text}"]`
                ))[0] as HTMLElement | undefined;
            }
            if (target === 'code') {
                return Array.from(document.querySelectorAll(
                    `[data-target="code"][data-lang="${lang}"][data-line="${line}"] [data-token-text="${text}"]`
                ))[0] as HTMLElement | undefined;
            }
            return undefined;
        };

        annotations.forEach(anno => {
            if (!anno.visible) return;
            const fromId = `anchor-${anno.id}-from`;
            const elFrom = getElement(anno.from.target, anno.from.lang, anno.from.line, anno.from.text);
            if (elFrom) { elFrom.id = fromId; mapping[fromId] = elFrom; }
            if (anno.to) {
                const toId = `anchor-${anno.id}-to`;
                const elTo = getElement(anno.to.target, anno.to.lang, anno.to.line, anno.to.text);
                if (elTo) { elTo.id = toId; mapping[toId] = elTo; }
            }
        });
        setAnchorElements(mapping);
        updateXarrow();
    }, [annotations, sourceCode, consoleOutput, language, zoomScale]);

    // 리사이즈 이벤트
    useEffect(() => {
        window.addEventListener('resize', updateXarrow);
        return () => window.removeEventListener('resize', updateXarrow);
    }, [updateXarrow]);

    // 마우스 휠 줌
    useEffect(() => {
        const container = document.getElementById('guide-preview-container');
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setZoomScale(prev => Math.min(3, Math.max(0.1, prev - e.deltaY * 0.005)));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // --- 단계 전환 헬퍼 ---
    const goToStep = useCallback((step: Step) => {
        setActiveStep(step);
    }, []);

    const completeStep = useCallback((step: Step, next: Step) => {
        setCompletedSteps(prev => new Set([...prev, step]));
        setActiveStep(next);
    }, []);

    // --- 어노테이션 핸들러 ---
    const handleAnnotationsLoaded = useCallback((loaded: Annotation[]) => {
        setAnnotations(loaded);
    }, []);

    const handleToggleVisibility = useCallback((id: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
    }, []);

    const handleDelete = useCallback((id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
    }, []);

    const handleUpdateComment = useCallback((id: string, comment: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, comment: comment || undefined } : a));
    }, []);

    // 현재 단계에 맞는 패널 제목
    const panelTitle: Record<Step, string> = {
        1: '① 코드 입력',
        2: '② AI 가이드 생성',
        3: '③ 결과 검토',
        4: '④ 내보내기',
    };

    return (
        <div className="flex h-full bg-neutral-100 text-neutral-800 font-sans">

            {/* ── 좌측 제어 패널 ── */}
            <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col gap-4 overflow-y-auto shrink-0 z-20 shadow-sm">
                {/* 헤더 */}
                <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
                    <h1 className="text-sm font-bold text-neutral-700 mb-3">입문자 코드 가이드</h1>
                    <StepIndicator
                        activeStep={activeStep}
                        completedSteps={completedSteps}
                        onStepClick={goToStep}
                    />
                </div>

                {/* 단계별 패널 */}
                <div className="px-5 pb-5 flex-1">
                    <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                        {panelTitle[activeStep]}
                    </h2>

                    {activeStep === 1 && (
                        <InputPanel
                            sourceCode={sourceCode}
                            consoleOutput={consoleOutput}
                            language={language}
                            onSourceCodeChange={setSourceCode}
                            onConsoleOutputChange={setConsoleOutput}
                            onLanguageChange={setLanguage}
                            onNext={() => completeStep(1, 2)}
                        />
                    )}

                    {activeStep === 2 && (
                        <GeneratePanel
                            prompt={buildPrompt(sourceCode, consoleOutput, language)}
                            onAnnotationsLoaded={handleAnnotationsLoaded}
                            onNext={() => completeStep(2, 3)}
                            onPrev={() => goToStep(1)}
                        />
                    )}

                    {activeStep === 3 && (
                        <ReviewPanel
                            annotations={annotations}
                            onToggleVisibility={handleToggleVisibility}
                            onDelete={handleDelete}
                            onUpdateComment={handleUpdateComment}
                            onNext={() => completeStep(3, 4)}
                            onPrev={() => goToStep(2)}
                        />
                    )}

                    {activeStep === 4 && (
                        <ExportPanel
                            annotations={annotations}
                            zoomScale={zoomScale}
                            onZoomReset={() => setZoomScale(1)}
                            onPrev={() => goToStep(3)}
                        />
                    )}
                </div>
            </aside>

            {/* ── 우측 메인 캔버스 영역 ── */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* 줌 컨트롤 툴바 */}
                <header className="h-12 bg-white border-b border-neutral-200 flex items-center justify-end px-4 shrink-0 gap-2 z-10">
                    <span className="text-xs text-neutral-400 mr-2">Ctrl+스크롤로 줌 조절</span>
                    <button onClick={() => setZoomScale(p => Math.max(0.1, p - 0.1))} className="p-1.5 hover:bg-neutral-100 rounded transition-colors" title="축소">
                        <ZoomOut className="w-4 h-4 text-neutral-500" />
                    </button>
                    <button onClick={() => setZoomScale(1)} className="px-2.5 py-1 text-xs font-bold hover:bg-neutral-100 transition-colors border-x border-neutral-200 min-w-[52px] text-center">
                        {Math.round(zoomScale * 100)}%
                    </button>
                    <button onClick={() => setZoomScale(p => Math.min(3, p + 0.1))} className="p-1.5 hover:bg-neutral-100 rounded transition-colors" title="확대">
                        <ZoomIn className="w-4 h-4 text-neutral-500" />
                    </button>
                </header>

                {/* 캔버스 */}
                <div className="flex-1 flex overflow-hidden">
                    <GuideCanvas
                        sourceCode={sourceCode}
                        consoleOutput={consoleOutput}
                        language={language}
                        annotations={annotations}
                        highlighter={highlighter}
                        zoomScale={zoomScale}
                        isExporting={isExporting}
                        anchorElements={anchorElements}
                        onScroll={updateXarrow}
                    />
                </div>
            </main>
        </div>
    );
}
