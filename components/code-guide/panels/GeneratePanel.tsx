'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Annotation } from '../types';

interface GeneratePanelProps {
    prompt: string;
    onAnnotationsLoaded: (annotations: Annotation[]) => void;
    onNext: () => void;
    onPrev: () => void;
}

function validateAnnotations(data: unknown): data is Annotation[] {
    if (!Array.isArray(data)) return false;
    return data.every((item) =>
        typeof item === 'object' && item !== null &&
        typeof (item as Annotation).id === 'string' &&
        ['box', 'arrow'].includes((item as Annotation).type) &&
        typeof (item as Annotation).visible === 'boolean' &&
        ['yellow', 'red', 'blue', 'green'].includes((item as Annotation).color) &&
        typeof (item as Annotation).from === 'object' &&
        typeof (item as Annotation).from.text === 'string'
    );
}

export default function GeneratePanel({ prompt, onAnnotationsLoaded, onNext, onPrev }: GeneratePanelProps) {
    const [promptCopied, setPromptCopied] = useState(false);
    const [jsonDraft, setJsonDraft] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [parseSuccess, setParseSuccess] = useState(false);

    const handleCopyPrompt = useCallback(async () => {
        await navigator.clipboard.writeText(prompt);
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2000);
    }, [prompt]);

    const handleLoadJson = useCallback(() => {
        setParseError(null);
        setParseSuccess(false);
        const trimmed = jsonDraft.trim();
        if (!trimmed) {
            setParseError('JSON이 비어 있습니다. AI의 응답을 붙여넣어 주세요.');
            return;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (!validateAnnotations(parsed)) {
                setParseError('JSON 구조가 올바르지 않습니다. 각 항목에 id, type, visible, color, from 필드가 필요합니다.');
                return;
            }
            onAnnotationsLoaded(parsed);
            setParseSuccess(true);
            // 0.6초 후 자동으로 다음 단계로 이동
            setTimeout(() => onNext(), 600);
        } catch (e) {
            const msg = e instanceof SyntaxError ? e.message : '알 수 없는 파싱 오류';
            setParseError(`JSON 파싱 실패: ${msg}`);
        }
    }, [jsonDraft, onAnnotationsLoaded, onNext]);

    return (
        <div className="flex flex-col gap-4">
            {/* AI 프롬프트 복사 영역 */}
            <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    Step 1 — AI에게 이 프롬프트를 복사해서 제공하세요
                </label>
                <div className="relative">
                    <textarea
                        readOnly
                        value={prompt}
                        className="w-full h-32 font-mono text-[10px] bg-blue-950 text-blue-200 p-3 rounded-lg border border-blue-800 resize-none focus:outline-none"
                    />
                    <button
                        onClick={handleCopyPrompt}
                        className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all
                            ${promptCopied ? 'bg-green-500 text-white' : 'bg-blue-700 hover:bg-blue-600 text-blue-100'}`}
                    >
                        {promptCopied ? <><Check className="w-3 h-3" /> 복사됨!</> : <><Copy className="w-3 h-3" /> 프롬프트 복사</>}
                    </button>
                </div>
                <p className="text-[9px] text-blue-600 mt-1">
                    💡 Claude, ChatGPT, Gemini 등 어떤 AI에도 사용 가능합니다.
                </p>
            </div>

            {/* JSON 붙여넣기 영역 */}
            <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    Step 2 — AI 응답 JSON을 여기에 붙여넣으세요
                </label>
                <textarea
                    value={jsonDraft}
                    onChange={(e) => { setJsonDraft(e.target.value); setParseError(null); setParseSuccess(false); }}
                    placeholder={'[\n  {\n    "id": "anno-1",\n    "type": "box",\n    ...\n  }\n]'}
                    className={`w-full h-40 font-mono text-xs p-3 rounded-lg border resize-none focus:outline-none transition-colors
                        ${parseError
                            ? 'bg-red-50 border-red-300 text-red-800 focus:border-red-400'
                            : parseSuccess
                                ? 'bg-green-50 border-green-300 text-green-800'
                                : 'bg-neutral-900 border-neutral-700 text-neutral-100 focus:border-blue-500'
                        }`}
                    spellCheck={false}
                />

                {/* 오류 메시지 */}
                {parseError && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{parseError}</span>
                    </div>
                )}

                {/* 성공 메시지 */}
                {parseSuccess && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <Check className="w-3.5 h-3.5" />
                        <span>어노테이션을 성공적으로 불러왔습니다. 결과 검토 단계로 이동합니다...</span>
                    </div>
                )}
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-2">
                <button
                    onClick={onPrev}
                    className="flex-1 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                    ← 뒤로
                </button>
                <button
                    onClick={handleLoadJson}
                    disabled={!jsonDraft.trim()}
                    className="flex-2 flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium text-sm transition-colors"
                >
                    가이드라인 불러오기
                </button>
            </div>
        </div>
    );
}
