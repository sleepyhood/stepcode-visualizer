// components/code-guide/types.ts
// 어노테이션 시스템의 핵심 타입 정의 — 단일 소스 오브 트루스

export type AnnotationType = 'box' | 'arrow';
export type AnnotationColor = 'yellow' | 'red' | 'blue' | 'green';
export type TargetLang = 'c' | 'cpp' | 'python' | 'java';
export type AnnotationTarget = 'code' | 'console';

export interface AnnotationAnchor {
    target: AnnotationTarget;
    lang?: TargetLang;
    line?: number;
    text: string;
    occurrenceIndex?: number; // 동일 텍스트 중 몇 번째 토큰을 대상으로 할지 (0-based, 기본값 0)
}

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
    boxOffset?: AnnotationOffset; // box 라벨의 좌상단 위치를 아트보드 좌표계 기준으로 미세 조정
    labelOffset?: AnnotationOffset; // arrow 라벨의 중심 위치를 아트보드 좌표계 기준으로 미세 조정
    from: AnnotationAnchor;
    to?: AnnotationAnchor;
}

export type Step = 1 | 2 | 3 | 4;

export interface StepInfo {
    number: Step;
    label: string;
    description: string;
}

export const STEPS: StepInfo[] = [
    { number: 1, label: '코드 입력',    description: '소스 코드와 콘솔 출력을 입력하세요' },
    { number: 2, label: 'AI 가이드 생성', description: 'AI에게 분석을 요청하고 결과를 붙여넣으세요' },
    { number: 3, label: '결과 검토',    description: '어노테이션을 확인하고 편집하세요' },
    { number: 4, label: '내보내기',     description: '이미지나 JSON으로 저장하세요' },
];

export const COLOR_HEX: Record<AnnotationColor, string> = {
    yellow: '#facc15',
    red:    '#ef4444',
    blue:   '#3b82f6',
    green:  '#22c55e',
};

export const COLOR_BG_CLASS: Record<AnnotationColor, string> = {
    yellow: 'bg-yellow-400',
    red:    'bg-red-500',
    blue:   'bg-blue-500',
    green:  'bg-green-500',
};

export const DEFAULT_SOURCE_CODE = `#include <stdio.h>

int main() {
    int ch1, ch2;

    ch1 = getchar();
    ch2 = getchar();

    printf("Result: %c %c\\n", ch1, ch2);
    return 0;
}`;

export const DEFAULT_CONSOLE_OUTPUT = `A\nResult: A `;
