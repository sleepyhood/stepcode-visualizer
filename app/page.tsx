'use client';

import { useState } from 'react';
import CodeVisualizer from '@/components/CodeVisualizer';
import MermaidVisualizer from '@/components/MermaidVisualizer';
import CodeGuideVisualizer from '@/components/CodeGuideVisualizer';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'code' | 'mermaid' | 'guide'>('code');

  return (
    <div className="flex flex-col h-screen bg-neutral-100 text-neutral-800 font-sans">

      {/* 글로벌 상단 탭 바 */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-10">
        <div className="font-bold text-lg mr-4 text-blue-600">StepCode Visualizer</div>
        <button
          onClick={() => setActiveTab('code')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'code' ? 'bg-blue-100 text-blue-700' : 'hover:bg-neutral-100 text-neutral-600'}`}
        >
          💻 코드 스니펫 모드
        </button>
        <button
          onClick={() => setActiveTab('mermaid')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'mermaid' ? 'bg-blue-100 text-blue-700' : 'hover:bg-neutral-100 text-neutral-600'}`}
        >
          📊 다이어그램 모드
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'guide' ? 'bg-blue-100 text-blue-700' : 'hover:bg-neutral-100 text-neutral-600'}`}
        >
          🎓 입문자 가이드 모드
        </button>
      </header>

      {/* 활성화된 탭 렌더링 영역 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'code' && <CodeVisualizer />}
        {activeTab === 'mermaid' && <MermaidVisualizer />}
        {activeTab === 'guide' && <CodeGuideVisualizer />}
      </main>

    </div>
  );
}