'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Image as ImageIcon, Terminal, Copy, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { createHighlighter, type HighlighterCore } from 'shiki';
import { toPng, toBlob } from 'html-to-image';

// 언어별 파일명 매핑용 (IDE 탭 디자인)
const FILE_NAMES: Record<string, string> = {
  c: 'main.c',
  cpp: 'main.cpp',
  python: 'solution.py',
  java: 'Solution.java'
};

// 명시적 언어 라벨 매핑용 (Badge)
const LANG_LABELS: Record<string, string> = {
  c: 'C',
  cpp: 'C++',
  python: 'Python',
  java: 'Java'
};

export default function CodeVisualizer() {
  // --- [상태 관리 (State)] ---
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['cpp', 'python']);
  const [codeData, setCodeData] = useState<Record<string, string>>({
    c: '', cpp: '', python: '', java: ''
  });
  
  // 기능 및 레이아웃 옵션
  const [layoutMode, setLayoutMode] = useState<'row' | 'column' | 'mixed-top' | 'mixed-bottom'>('row');
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [consoleData, setConsoleData] = useState<string>('출력 결과가 여기에 표시됩니다.');
  const [currentTheme, setCurrentTheme] = useState<string>('one-dark-pro');

  // --- [Phase 3: 디자인 & 캡처 상태] ---
  const [padding, setPadding] = useState<number>(16);
  const [containerWidth, setContainerWidth] = useState<number>(600); // 전체 너비 상태 추가
  const [dropShadow, setDropShadow] = useState<'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'>('2xl');
  const [showWindowFrame, setShowWindowFrame] = useState<boolean>(true);
  
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [draggedLang, setDraggedLang] = useState<string | null>(null); // 현재 드래그 중인 언어
  const [dragOverLang, setDragOverLang] = useState<string | null>(null); // 드롭 타겟(눈금 표시) 언어

  const [zoomScale, setZoomScale] = useState<number>(1); // 화면 줌(Zoom) 배율 상태
  // Shiki 하이라이터 인스턴스 및 렌더링된 HTML 상태
const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
// const [htmlOutput, setHtmlOutput] = useState<Record<string, string>>({});

  // --- [1. Shiki 초기화 (최초 1회)] ---
  useEffect(() => {
    async function initShiki() {
      const hl = await createHighlighter({
        themes: ['github-dark', 'github-light', 'monokai', 'dracula', 'nord', 'one-dark-pro'],
        langs: ['c', 'cpp', 'python', 'java'],
      });
      setHighlighter(hl);
    }
    initShiki();
  }, []);

  // --- [2. 코드 실시간 렌더링] ---
  // htmlOutput 상태 선언(useState) 삭제 및 파생 상태로 대체
  const htmlOutput = useMemo(() => {
    if (!highlighter) return {};

    const newHtml: Record<string, string> = {};
    selectedLanguages.forEach((lang) => {
      const code = codeData[lang] || '';
      if (code.trim() === '') {
        newHtml[lang] = `<pre class="shiki" style="padding: 1rem; min-height: 100px;"><code><span class="line" style="color: #6b7280; font-style: italic;">// ${lang.toUpperCase()} 코드를 입력해주세요.</span></code></pre>`;
      } else {
        newHtml[lang] = highlighter.codeToHtml(code, {
          lang,
          theme: currentTheme,
        });
      }
    });
    return newHtml;
  }, [codeData, selectedLanguages, highlighter, currentTheme]);

  // --- [핸들러 함수] ---
  const handleLanguageToggle = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

// 드래그 앤 드롭으로 순서 변경하는 핸들러
  const handleDrop = (targetLang: string) => {
    setDragOverLang(null); // 드롭 가이드라인 해제
    if (!draggedLang || draggedLang === targetLang) return;
    setSelectedLanguages((prev) => {
      const newArr = [...prev];
      const draggedIdx = newArr.indexOf(draggedLang);
      const targetIdx = newArr.indexOf(targetLang);
      newArr.splice(draggedIdx, 1); // 원래 위치에서 제거
      newArr.splice(targetIdx, 0, draggedLang); // 새로운 위치에 삽입
      return newArr;
    });
    setDraggedLang(null);
  };

  const handleDownloadImage = useCallback(async () => {
    if (isExporting) return; // 중복 실행 방지
    const node = document.getElementById('capture-target');
    if (!node) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(node, { pixelRatio: 2 }); // 고해상도 캡처
      const link = document.createElement('a');
      link.download = 'stepcode_snippet.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('이미지 다운로드 실패:', err);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const handleCopyToClipboard = useCallback(async () => {
    if (isExporting) return; // 중복 실행 방지
    const node = document.getElementById('capture-target');
    if (!node) return;
    try {
      setCopyStatus('idle');
      setIsExporting(true);
      const blob = await toBlob(node, { pixelRatio: 2 });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
      }
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setCopyStatus('error');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // --- [단축키 (Keyboard Shortcuts) 연동] ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S : 이미지로 저장 (브라우저 기본 웹페이지 저장 방지)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleDownloadImage();
      }
      // Cmd/Ctrl + Shift + C : 클립보드에 복사 
      // (입력창 내부의 단순 텍스트 복사와 충돌하지 않도록 Shift 조합)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyToClipboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDownloadImage, handleCopyToClipboard]);

// --- [스마트 줌: 마우스 휠 이벤트 제어] ---
  useEffect(() => {
    const container = document.getElementById('preview-container');
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // 브라우저 전체 화면 줌인 방지
        setZoomScale(prev => {
          // 휠 방향에 따라 0.05배씩 증감, 최소 10% ~ 최대 300% 제한
          const newScale = prev - (e.deltaY * 0.005);
          return Math.min(Math.max(0.1, newScale), 3);
        });
      }
    };

    // passive: false 옵션을 주어야 e.preventDefault()가 정상 동작함
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Tailwind 동적 클래스 매핑 (safelist 우회)
  const shadowClass = {
    none: 'shadow-none', sm: 'shadow-sm', md: 'shadow-md',
    lg: 'shadow-lg', xl: 'shadow-xl', '2xl': 'shadow-2xl'
  }[dropShadow];

  
// Tailwind 동적 Grid 컨테이너 및 아이템 클래스 계산 로직
  const getContainerClass = () => {
    if (layoutMode === 'column') return 'grid-cols-1';
    if (layoutMode.includes('mixed')) return 'grid-cols-2'; // 혼합 배치는 2단 그리드 기반
    return { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[selectedLanguages.length] || 'grid-cols-1';
  };

  const getItemSpanClass = (index: number) => {
    if (selectedLanguages.length !== 3) return 'col-span-1'; // 혼합 템플릿은 3개일 때만 적용됨
    if (layoutMode === 'mixed-top' && index === 2) return 'col-span-2'; // 상단2: 마지막 요소 꽉 채우기
    if (layoutMode === 'mixed-bottom' && index === 0) return 'col-span-2'; // 하단2: 첫 요소 꽉 채우기
    return 'col-span-1';
  };

  return (
    <div className="flex h-full bg-neutral-100 text-neutral-800 font-sans">
      
      {/* 1. 제어부 (Control Panel) */}
      <aside className="w-80 bg-white border-r border-neutral-200 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 border-b pb-4">
          <Settings className="w-5 h-5 text-neutral-500" />
          <h1 className="text-lg font-bold">StepCode Visualizer</h1>
        </div>

        {/* 언어 선택 */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 mb-3">언어 선택</h2>
          <div className="flex flex-wrap gap-2">
            {['c', 'cpp', 'python', 'java'].map((lang) => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer bg-neutral-50 px-3 py-2 rounded border hover:bg-neutral-100 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(lang)}
                  onChange={() => handleLanguageToggle(lang)}
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                <span className="uppercase text-sm font-medium">{lang}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 레이아웃 및 옵션 제어 */}
        <section className="flex flex-col gap-4 border-t pt-4">
           {/* 복구된 테마 선택 UI */}
           <div>
             <h2 className="text-sm font-semibold text-neutral-500 mb-2">테마 선택</h2>
             <select 
               className="w-full p-2 border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
               value={currentTheme}
               onChange={(e) => setCurrentTheme(e.target.value)}
             >
               <option value="github-dark">GitHub Dark</option>
               <option value="github-light">GitHub Light</option>
               <option value="monokai">Monokai</option>
               <option value="dracula">Dracula</option>
               <option value="nord">Nord</option>
              <option value="one-dark-pro">One Dark Pro</option>
             </select>
           </div>
           
           <div>
             <h2 className="text-sm font-semibold text-neutral-500 mb-2">배치 방식</h2>
             <div className="flex flex-col gap-1 bg-neutral-100 rounded p-1">
               <div className="flex gap-1">
                 <button onClick={() => setLayoutMode('row')} className={`flex-1 py-1 text-xs rounded ${layoutMode === 'row' ? 'bg-white shadow' : 'text-neutral-500'}`}>가로 배열</button>
                 <button onClick={() => setLayoutMode('column')} className={`flex-1 py-1 text-xs rounded ${layoutMode === 'column' ? 'bg-white shadow' : 'text-neutral-500'}`}>세로 배열</button>
               </div>
               <div className="flex gap-1">
                 <button onClick={() => setLayoutMode('mixed-top')} className={`flex-1 py-1 text-xs rounded ${layoutMode === 'mixed-top' ? 'bg-white shadow' : 'text-neutral-500'}`} title="3개 선택시 유효 (상단 2칸, 하단 1칸)">혼합 (상단2)</button>
                 <button onClick={() => setLayoutMode('mixed-bottom')} className={`flex-1 py-1 text-xs rounded ${layoutMode === 'mixed-bottom' ? 'bg-white shadow' : 'text-neutral-500'}`} title="3개 선택시 유효 (상단 1칸, 하단 2칸)">혼합 (하단2)</button>
               </div>
             </div>
           </div>


           <label className="flex items-center gap-2 cursor-pointer mt-2 border-b pb-4">
             <input type="checkbox" checked={showConsole} onChange={() => setShowConsole(!showConsole)} className="rounded text-blue-500" />
             <span className="text-sm font-medium">실행 결과 (콘솔) 표시</span>
           </label>

           {/* 세부 디자인 옵션 */}
           <div className="flex flex-col gap-3 pt-2">
             <h2 className="text-sm font-semibold text-neutral-500">디자인 설정</h2>
             
             <label className="flex items-center justify-between text-sm">
               <span>전체 너비 (Width)</span>
               <input type="range" min="600" max="1400" step="50" value={containerWidth} onChange={(e) => setContainerWidth(Number(e.target.value))} className="w-24" />
             </label>

             <label className="flex items-center justify-between text-sm">
               <span>여백 (Padding)</span>
               <input type="range" min="16" max="64" step="8" value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="w-24" />
             </label>

             <label className="flex flex-col gap-1 text-sm">
               <span>그림자 (Shadow)</span>
               <select className="w-full p-1 border rounded text-sm" value={dropShadow} onChange={(e) => setDropShadow(e.target.value as 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl')}>
                 <option value="none">없음</option>
                 <option value="md">중간</option>
                 <option value="xl">크게</option>
                 <option value="2xl">아주 크게 (기본)</option>
               </select>
             </label>

             <label className="flex items-center gap-2 cursor-pointer mt-1 text-sm">
               <input type="checkbox" checked={showWindowFrame} onChange={() => setShowWindowFrame(!showWindowFrame)} className="rounded text-blue-500" />
               <span>Mac 스타일 창 버튼 표시</span>
             </label>
           </div>
        </section>
      </aside>
      

      {/* 메인 작업 영역 */}
      <main className="flex-1 flex flex-col min-w-0">
        
   {/* 상단 툴바 */}
        <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-end px-6 shrink-0 gap-2">
          <button 
            onClick={handleCopyToClipboard}
            disabled={isExporting}
            title="단축키: Ctrl+Shift+C (Mac: Cmd+Shift+C)"
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${copyStatus === 'copied' ? 'bg-green-100 text-green-700' : 'bg-white border hover:bg-neutral-50 text-neutral-700'}`}
          >
            {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copyStatus === 'copied' ? '복사 완료!' : '클립보드에 복사'}
          </button>
          <button 
            onClick={handleDownloadImage}
            disabled={isExporting}
            title="단축키: Ctrl+S (Mac: Cmd+S)"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            {isExporting ? '처리 중...' : '이미지로 저장 (PNG)'}
          </button>
        </header>

        {/* 2단 분할 영역: 입력부 & 미리보기부 */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* 2. 입력부 (Input Area) */}
          <section className="w-[350px] bg-neutral-50 border-r border-neutral-200 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
            <h2 className="text-sm font-semibold text-neutral-500 mb-2">코드 작성</h2>
            
            {selectedLanguages.length === 0 && (
              <div className="text-sm text-neutral-400 text-center mt-10">좌측에서 언어를 선택해주세요.</div>
            )}
            
            {selectedLanguages.map((lang) => (
              <div key={lang} className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-neutral-600">{lang} <span className="text-neutral-400 font-normal ml-1">({FILE_NAMES[lang]})</span></label>
                <textarea
                  className="w-full h-40 p-3 text-sm font-mono border border-neutral-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  placeholder={`여기에 코드를 입력하세요...`}
                  value={codeData[lang]}
                  onChange={(e) => setCodeData({ ...codeData, [lang]: e.target.value })}
                  spellCheck={false}
                />
              </div>
            ))}

            {showConsole && (
              <div className="flex flex-col gap-1 border-t pt-4 mt-2">
                <label className="text-xs font-bold text-neutral-600 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Console Mock-up
                </label>
                <textarea
                  className="w-full h-24 p-3 text-sm font-mono bg-neutral-900 text-green-400 border border-neutral-800 rounded-md shadow-sm focus:ring-2 focus:ring-green-500 resize-y"
                  placeholder="의도한 실행 결과를 입력하세요..."
                  value={consoleData}
                  onChange={(e) => setConsoleData(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </section>

        {/* 3. 미리보기부 (Preview Canvas) */}
          <section 
            id="preview-container"
            className="flex-1 bg-neutral-300 overflow-auto relative flex items-center justify-center min-w-0"
          >
            
            {/* Zoom Wrapper (시각적 확대/축소만 담당하며 캡처 화질에는 영향을 주지 않음) */}
            <div 
              className="transition-transform duration-75 origin-center"
              style={{ transform: `scale(${zoomScale})` }}
            >
              {/* 캡처 대상 영역 (원본 해상도 유지) */}
              <div 
                id="capture-target" 
                className="w-full transition-all duration-300 flex flex-col shrink-0 gap-4 bg-[#e5e5e5]"
                style={{ padding: `${padding}px`, maxWidth: `${containerWidth}px` }}
              >
                 
               {/* 코드 블록 그리드 */}
              {!highlighter ? (
                <div className="text-center text-neutral-500 font-medium">Shiki 엔진 로딩 중...</div>
              ) : (
                <div className={`grid gap-6 ${getContainerClass()}`}>
                  {selectedLanguages.map((lang, index) => (
                    <div 
                      key={lang} 
                      draggable={true}
                      onDragStart={() => setDraggedLang(lang)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverLang !== lang) setDragOverLang(lang);
                      }}
                      onDragLeave={() => setDragOverLang(null)}
                      onDrop={() => handleDrop(lang)}
                      className={`flex flex-col h-full rounded-xl overflow-hidden ${shadowClass} cursor-grab active:cursor-grabbing transition-all duration-200 ${getItemSpanClass(index)} ${dragOverLang === lang ? 'ring-4 ring-blue-500 opacity-80 scale-[0.98]' : ''}`} 
                      style={{ backgroundColor: currentTheme.includes('light') ? '#ffffff' : '#24292e' }}
                    >
                      
                      {/* 1. Mac OS 스타일 타이틀바 & 언어 배지 */}
                      {showWindowFrame && (
                        <div className="flex items-center justify-between px-4 py-3 bg-black/10">
                          <div className="flex items-center">
                            <div className="flex gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <div className="ml-4 text-xs font-mono opacity-60" style={{ color: currentTheme.includes('light') ? '#000' : '#fff' }}>
                              {FILE_NAMES[lang]}
                            </div>
                          </div>
                          {/* 배지 (Badge) */}
                          <div className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-black/20" style={{ color: currentTheme.includes('light') ? '#333' : '#eee' }}>
                            {LANG_LABELS[lang]}
                          </div>
                        </div>
                      )}
                      
                      {/* Shiki HTML 주입 영역 (2. 줄바꿈, 3. 줄번호, 4. 세로 꽉채우기 flex-1) */}
                      <div 
                        className="flex-1 text-[14px] leading-relaxed font-mono [&>pre]:!bg-transparent [&>pre]:p-4 [&>pre]:m-0 [&>pre]:whitespace-pre-wrap [&>pre]:break-all [&_code]:[counter-reset:step] [&_.line::before]:content-[counter(step)] [&_.line::before]:[counter-increment:step] [&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-8 [&_.line::before]:whitespace-nowrap [&_.line::before]:text-right [&_.line::before]:opacity-50"
                        dangerouslySetInnerHTML={{ __html: htmlOutput[lang] || '' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 콘솔 목업 렌더링 영역 */}
              {showConsole && selectedLanguages.length > 0 && (
                <div className="mt-2 rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] border border-neutral-700">
                   <div className="flex items-center px-4 py-2 bg-black/40 text-neutral-400 text-xs font-mono gap-2">
                     <Terminal className="w-3 h-3" /> Output
                   </div>
                   <div className="p-4 text-[14px] font-mono whitespace-pre-wrap text-neutral-300">
                     {consoleData}
                   </div>
                </div>
              )}

  </div>
            </div> {/* Zoom Wrapper 닫기 */}

            {/* 플로팅 줌(Zoom) 컨트롤러 */}
            <div className="absolute bottom-6 right-6 flex items-center bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden text-neutral-600 z-10">
              <button 
                onClick={() => setZoomScale(p => Math.max(0.1, p - 0.1))} 
                className="p-2 hover:bg-neutral-100 transition-colors active:bg-neutral-200" 
                title="축소"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setZoomScale(1)} 
                className="px-3 py-2 text-xs font-bold hover:bg-neutral-100 transition-colors border-x border-neutral-200" 
                title="100% 원본 크기"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button 
                onClick={() => setZoomScale(p => Math.min(3, p + 0.1))} 
                className="p-2 hover:bg-neutral-100 transition-colors active:bg-neutral-200" 
                title="확대"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

          </section>

        </div>
      </main>
    </div>
  );
}