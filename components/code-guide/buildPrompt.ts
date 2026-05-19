// components/code-guide/buildPrompt.ts
// AI에게 전달할 완성형 프롬프트를 동적으로 생성한다.
// 기존의 고정 상수(AI_PROMPT_TEMPLATE)를 대체한다.

import { TargetLang } from './types';

const ANNOTATION_SCHEMA = `interface Annotation {
  id: string;           // 고유 ID (예: 'anno-1')
  type: 'box' | 'arrow'; // 강조 박스 또는 연결 화살표
  visible: boolean;     // 기본값 true
  color: 'yellow' | 'red' | 'blue' | 'green';
  comment?: string;     // 화면에 표시할 설명 문구
  from: {
    target: 'code' | 'console'; // 시작점이 코드인지 콘솔인지
    lang?: string;               // 코드인 경우 언어 (예: 'c')
    line?: number;               // 코드인 경우 줄 번호
    text: string;                // 앵커로 사용할 정확한 단어 (Shiki 토큰 단위)
  };
  to?: {                         // arrow 타입 전용 도착점
    target: 'code' | 'console';
    lang?: string;
    line?: number;
    text: string;
  };
}`;

export function buildPrompt(
    sourceCode: string,
    consoleOutput: string,
    language: TargetLang
): string {
    return `[System: Code Guide Annotation AI]
당신은 프로그래밍 입문자를 위한 시각적 코드 가이드를 생성하는 AI입니다.
아래의 소스 코드와 콘솔 출력 결과를 분석하여 다음 JSON 스키마를 따르는 어노테이션 배열을 반환하세요.

## 분석 대상 소스 코드 (언어: ${language})
\`\`\`${language}
${sourceCode}
\`\`\`

## 콘솔 출력 결과
\`\`\`
${consoleOutput}
\`\`\`

## 출력 JSON 스키마
\`\`\`typescript
${ANNOTATION_SCHEMA}
\`\`\`

## 중요 규칙
- text 필드는 Shiki 토크나이저가 분리하는 정확한 단어 단위로 지정해야 합니다.
  예: \`getchar()\` 전체가 아닌 \`getchar\`로 지정하세요.
- 줄 번호(line)는 소스 코드의 실제 줄 번호를 그대로 사용하세요 (1부터 시작).
- 콘솔 출력의 앵커는 공백으로 분리된 단어 단위로 지정하세요.
- box 타입은 to 필드 없이 강조만 할 때 사용하고,
  arrow 타입은 코드와 콘솔 사이의 데이터 흐름을 연결할 때 사용하세요.
- 입문자가 이해하기 쉬운 한국어로 comment를 작성하세요.

반드시 JSON 배열 형태로만 응답하세요. 설명 텍스트 없이 JSON만 반환하세요.`;
}

/**
 * 현재 어노테이션 배열을 소스 코드 주석 포맷으로 직렬화한다.
 * C/C++ 스타일 블록 주석으로 감싸서 코드 파일에 붙여 넣을 수 있게 한다.
 */
export function serializeToComment(annotations: object[]): string {
    const json = JSON.stringify(annotations, null, 2);
    return `/* GUIDE_ANNOTATIONS
${json}
*/`;
}
