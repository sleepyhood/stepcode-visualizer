'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Code, Download } from 'lucide-react';
import { Annotation } from '../types';
import { serializeToComment } from '../buildPrompt';
import { getFontEmbedCSS, toBlob, toPng } from 'html-to-image';

interface ExportPanelProps {
    annotations: Annotation[];
    onPrev: () => void;
    onPrepareCapture: () => Promise<() => Promise<void>>;
    captureTargetId?: string;
}

type CopyKey = 'png' | 'json' | 'comment';

export default function ExportPanel({
    annotations,
    onPrev,
    onPrepareCapture,
    captureTargetId = 'capture-target',
}: ExportPanelProps) {
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState<CopyKey | null>(null);

    const markCopied = (key: CopyKey) => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const buildCaptureOptions = useCallback(async (node: HTMLElement) => ({
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: true,
        preferredFontFormat: 'woff2' as const,
        backgroundColor: '#d4d4d8',
        fontEmbedCSS: await getFontEmbedCSS(node),
    }), []);

    const handleDownloadPng = useCallback(async () => {
        if (exporting) return;
        setExporting(true);
        const restoreCapture = await onPrepareCapture();
        try {
            const node = document.getElementById(captureTargetId);
            if (!node) return;
            const url = await toPng(node, await buildCaptureOptions(node));
            const a = document.createElement('a');
            a.download = 'code_guide.png';
            a.href = url;
            a.click();
        } catch (e) { console.error(e); }
        finally {
            await restoreCapture();
            setExporting(false);
        }
    }, [buildCaptureOptions, captureTargetId, exporting, onPrepareCapture]);

    const handleCopyPng = useCallback(async () => {
        if (exporting) return;
        setExporting(true);
        const restoreCapture = await onPrepareCapture();
        try {
            const node = document.getElementById(captureTargetId);
            if (!node) return;
            const blob = await toBlob(node, await buildCaptureOptions(node));
            if (blob) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                markCopied('png');
            }
        } catch (e) { console.error(e); }
        finally {
            await restoreCapture();
            setExporting(false);
        }
    }, [buildCaptureOptions, captureTargetId, exporting, onPrepareCapture]);

    const handleCopyJson = useCallback(async () => {
        const json = JSON.stringify(annotations, null, 2);
        await navigator.clipboard.writeText(json);
        markCopied('json');
    }, [annotations]);

    const handleCopyComment = useCallback(async () => {
        const text = serializeToComment(annotations);
        await navigator.clipboard.writeText(text);
        markCopied('comment');
    }, [annotations]);

    const btnBase = 'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all border';
    const btnPrimary = `${btnBase} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`;
    const btnSecondary = `${btnBase} bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50`;
    const btnSuccess = `${btnBase} bg-green-500 text-white border-green-500`;

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[10px] text-neutral-400 leading-relaxed">
                완성된 코드 가이드를 이미지 또는 데이터로 저장하세요.
            </p>

            {/* 이미지 저장 */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">이미지</span>
                <button onClick={handleDownloadPng} disabled={exporting} className={btnPrimary}>
                    <Download className="w-4 h-4" />
                    {exporting ? '처리 중...' : 'PNG 파일로 저장'}
                </button>
                <button
                    onClick={handleCopyPng}
                    disabled={exporting}
                    className={copied === 'png' ? btnSuccess : btnSecondary}
                >
                    {copied === 'png' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'png' ? '복사 완료!' : '클립보드에 PNG 복사'}
                </button>
            </div>

            {/* 데이터 내보내기 */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">데이터</span>
                <button
                    onClick={handleCopyJson}
                    className={copied === 'json' ? btnSuccess : btnSecondary}
                >
                    {copied === 'json' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                    {copied === 'json' ? '복사 완료!' : 'JSON 배열로 복사'}
                </button>
                <button
                    onClick={handleCopyComment}
                    className={copied === 'comment' ? btnSuccess : btnSecondary}
                >
                    {copied === 'comment' ? <Check className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                    {copied === 'comment' ? '복사 완료!' : '코드 주석 형태로 복사 (/* ... */)'}
                </button>
                <p className="text-[9px] text-neutral-400 mt-0.5">
                    💡 복사한 JSON을 다음에 이 도구에 붙여넣으면 가이드를 재사용할 수 있습니다.
                </p>
            </div>

            {/* 뒤로 */}
            <button
                onClick={onPrev}
                className="mt-1 w-full py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
                ← 검토 단계로 돌아가기
            </button>
        </div>
    );
}
