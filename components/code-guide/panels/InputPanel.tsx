'use client';

import { TargetLang } from '../types';

interface InputPanelProps {
    sourceCode: string;
    consoleOutput: string;
    language: TargetLang;
    onSourceCodeChange: (code: string) => void;
    onConsoleOutputChange: (output: string) => void;
    onLanguageChange: (lang: TargetLang) => void;
    onNext: () => void;
}

const LANGUAGE_OPTIONS: { value: TargetLang; label: string }[] = [
    { value: 'c',      label: 'C언어' },
    { value: 'cpp',    label: 'C++' },
    { value: 'python', label: 'Python' },
    { value: 'java',   label: 'Java' },
];

export default function InputPanel({
    sourceCode,
    consoleOutput,
    language,
    onSourceCodeChange,
    onConsoleOutputChange,
    onLanguageChange,
    onNext,
}: InputPanelProps) {
    const canProceed = sourceCode.trim().length > 0;

    return (
        <div className="flex flex-col gap-4">
            {/* 언어 선택 */}
            <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    프로그래밍 언어
                </label>
                <div className="flex gap-1.5 flex-wrap">
                    {LANGUAGE_OPTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onLanguageChange(value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                                ${language === value
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-blue-300'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 소스 코드 입력 */}
            <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    소스 코드
                </label>
                <textarea
                    value={sourceCode}
                    onChange={(e) => onSourceCodeChange(e.target.value)}
                    placeholder="분석할 소스 코드를 여기에 붙여넣으세요..."
                    className="w-full h-44 font-mono text-xs bg-neutral-900 text-neutral-100 p-3 rounded-lg border border-neutral-700 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                    spellCheck={false}
                />
            </div>

            {/* 콘솔 출력 입력 */}
            <div>
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    콘솔 출력 (실행 결과)
                </label>
                <textarea
                    value={consoleOutput}
                    onChange={(e) => onConsoleOutputChange(e.target.value)}
                    placeholder="프로그램을 실행했을 때 나오는 출력 결과를 붙여넣으세요..."
                    className="w-full h-20 font-mono text-xs bg-neutral-900 text-green-400 p-3 rounded-lg border border-neutral-700 focus:outline-none focus:border-blue-500 resize-none"
                    spellCheck={false}
                />
                <p className="text-[9px] text-neutral-400 mt-1">
                    💡 실제 입력값도 포함하세요. 줄바꿈은 Enter로 구분됩니다.
                </p>
            </div>

            {/* 다음 버튼 */}
            <button
                onClick={onNext}
                disabled={!canProceed}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
                다음: AI 가이드 생성 →
            </button>
        </div>
    );
}
