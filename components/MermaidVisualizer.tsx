'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Image as ImageIcon, Copy, Check, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import mermaid from 'mermaid';

// 초기 데모 코드
const DEFAULT_CODE = `graph TD
    A[Start] --> B{Is it raining?}
    B -- Yes --> C[Take an umbrella]
    B -- No --> D[Enjoy the sun]
    C --> E[Go outside]
    D --> E`;

export default function MermaidVisualizer() {
  // --- [상태 관리] ---
  const [mermaidCode, setMermaidCode] = useState<string>(DEFAULT_CODE);
  const [debouncedCode, setDebouncedCode] = useState<string>(DEFAULT_CODE);
  const [currentTheme, setCurrentTheme] = useState<'default' | 'dark' | 'forest' | 'neutral'>('default');
  
  // 기능 및 레이아웃 옵션
  const [padding, setPadding] = useState<number>(16);
  const [isTransparent, setIsTransparent] = useState<boolean>(false);
  const [showWindowFrame, setShowWindowFrame] = useState<boolean>(true);
  const [dropShadow, setDropShadow] = useState<'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'>('2xl');

  // SVG 렌더링 결과 및 에러 상태
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [zoomScale, setZoomScale] = useState<number>(1); // 화면 줌(Zoom) 배율 상태

  // --- [1. Debounce 로직 (타이핑 시 렉 방지)] ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCode(mermaidCode);
    }, 500); // 0.5초간 입력이 없으면 렌더링 갱신
    return () => clearTimeout(handler);
  }, [mermaidCode]);

  // --- [2. Mermaid 렌더링 로직] ---
  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!debouncedCode.trim()) {
        if (isMounted) {
          setSvgContent('');
          setRenderError(null);
        }
        return;
      }

      try {
        // 매 렌더링마다 선택된 테마로 초기화
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: currentTheme,
          fontFamily: 'inherit' // 외부 캡처 시 폰트 깨짐 방지
        });
        
        // 고유 ID 생성 (동일 ID 재렌더링 시 발생하는 충돌 방지)
        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(id, debouncedCode);
        
        if (isMounted) {
          setSvgContent(svg);
          setRenderError(null);
        }
      } catch {
        if (isMounted) {
          setRenderError('다이어그램 문법을 확인해 주세요.');
          // Mermaid 라이브러리가 강제로 document.body에 추가하는 에러 툴팁 DOM 정리
          const errorTooltip = document.querySelector(`[id^="dmermaid-svg-"]`);
          if (errorTooltip) errorTooltip.remove();
        }
      }
    };

    renderDiagram();
    
    return () => { isMounted = false; };
  }, [debouncedCode, currentTheme]);

  // --- [3. 캡처 및 내보내기 로직] ---
  // 투명 배경일 땐 명시적으로 rgba(0,0,0,0)을 넘겨 투명화, 아닐 경우 부모 div색상 보존
  const getCaptureOptions = useCallback(() => ({
    pixelRatio: 2,
    backgroundColor: isTransparent ? 'rgba(0,0,0,0)' : '#e5e5e5', 
  }), [isTransparent]);

// 💡 새롭게 추가되는 SVG 저장 함수
  const handleDownloadSVG = useCallback(() => {
    if (!svgContent || renderError) return;
    
    // SVG는 XML 기반이므로 <foreignObject> 내부의 HTML <br> 태그가
    // XML 파서에서 "tag mismatch" 에러를 유발합니다.
    // 저장 전에 <br> → <br/> 로 치환하여 well-formed XML로 수정합니다.
    const fixedSvg = svgContent.replace(/<br>/gi, '<br/>');

    const blob = new Blob([fixedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stepcode_diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
  }, [svgContent, renderError]);

  const handleDownloadImage = useCallback(async () => {
    if (isExporting || renderError) return;
    const node = document.getElementById('mermaid-capture-target');
    if (!node) return;
    try {
      setIsExporting(true);
      // 💡 핵심: 줌 배율이 100%로 초기화된 DOM이 반영될 때까지 대기 (화질 보장)
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const dataUrl = await toPng(node, getCaptureOptions());
      const link = document.createElement('a');
      link.download = 'stepcode_diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('이미지 다운로드 실패:', err);
    } finally {
      setIsExporting(false);
    }
  }, [getCaptureOptions, isExporting, renderError]);

  const handleCopyToClipboard = useCallback(async () => {
    if (isExporting || renderError) return;
    const node = document.getElementById('mermaid-capture-target');
    if (!node) return;
    try {
      setCopyStatus('idle');
      setIsExporting(true);
      const blob = await toBlob(node, getCaptureOptions());
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
  }, [getCaptureOptions, isExporting, renderError]);

  // --- [단축키 연동] ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleDownloadImage();
      }
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
    const container = document.getElementById('mermaid-preview-container');
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoomScale(prev => {
          const newScale = prev - (e.deltaY * 0.005);
          return Math.min(Math.max(0.1, newScale), 3);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Tailwind 동적 클래스 매핑 (safelist 우회)
  const shadowClass = {
    none: 'shadow-none', sm: 'shadow-sm', md: 'shadow-md',
    lg: 'shadow-lg', xl: 'shadow-xl', '2xl': 'shadow-2xl'
  }[dropShadow];

  return (
    <div className="flex h-full bg-neutral-100 text-neutral-800 font-sans">
      
      {/* 1. 제어부 (Control Panel) */}
      <aside className="w-80 bg-white border-r border-neutral-200 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 border-b pb-4">
          <Settings className="w-5 h-5 text-neutral-500" />
          <h1 className="text-lg font-bold">다이어그램 설정</h1>
        </div>

        <section className="flex flex-col gap-4">
           <div>
             <h2 className="text-sm font-semibold text-neutral-500 mb-2">테마 선택</h2>
             <select 
               className="w-full p-2 border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
               value={currentTheme}
               onChange={(e) => setCurrentTheme(e.target.value as 'default' | 'dark' | 'forest' | 'neutral')}
             >
               <option value="default">기본 (Default)</option>
               <option value="dark">다크 (Dark)</option>
               <option value="forest">숲 (Forest)</option>
               <option value="neutral">중립 (Neutral)</option>
             </select>
           </div>

           <div className="flex flex-col gap-3 pt-2 border-t mt-2">
             <h2 className="text-sm font-semibold text-neutral-500">디자인 설정</h2>
             
             <label className="flex items-center justify-between text-sm">
               <span>여백 (Padding)</span>
               <input type="range" min="16" max="128" step="8" value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="w-24" />
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

             <label className="flex items-center gap-2 cursor-pointer mt-1 text-sm">
               <input type="checkbox" checked={isTransparent} onChange={() => setIsTransparent(!isTransparent)} className="rounded text-blue-500" />
               <span>배경 투명하게 캡처</span>
             </label>
           </div>
        </section>
      </aside>

      {/* 메인 작업 영역 */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* 상단 툴바 */}
        <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-end px-6 shrink-0 gap-2">
          {/* 💡 추가: SVG 저장 버튼 (고화질 벡터) */}
          <button 
            onClick={handleDownloadSVG}
            disabled={isExporting || !!renderError}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            벡터로 저장 (SVG)
          </button>
          
          <button 
            onClick={handleCopyToClipboard}
            disabled={isExporting || !!renderError}
            title="단축키: Ctrl+Shift+C (Mac: Cmd+Shift+C)"
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${copyStatus === 'copied' ? 'bg-green-100 text-green-700' : 'bg-white border hover:bg-neutral-50 text-neutral-700'} disabled:opacity-50`}
          >
            {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copyStatus === 'copied' ? '복사 완료!' : '클립보드에 복사'}
          </button>
          <button 
            onClick={handleDownloadImage}
            disabled={isExporting || !!renderError}
            title="단축키: Ctrl+S (Mac: Cmd+S)"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            {isExporting ? '처리 중...' : '이미지로 저장 (PNG)'}
          </button>
        </header>

        {/* 2단 분할 영역 */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* 입력부 */}
          <section className="w-[350px] bg-neutral-50 border-r border-neutral-200 p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
            <h2 className="text-sm font-semibold text-neutral-500 mb-1">Mermaid 문법 작성</h2>
            <p className="text-xs text-neutral-400 mb-2">graph TD, sequenceDiagram 등을 입력하세요.</p>
            <textarea
              className="w-full flex-1 p-4 text-sm font-mono border border-neutral-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white leading-relaxed"
              placeholder="여기에 문법을 입력하세요..."
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              spellCheck={false}
            />
          </section>

          {/* 미리보기부 */}
          <section 
            id="mermaid-preview-container"
            className="flex-1 bg-neutral-300 overflow-auto relative flex" // 💡 overflow-auto 및 flex 정렬 수정
            style={{ 
              backgroundImage: isTransparent ? 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/ENAEU/8nJCxa1ICRzBDEB2PzAAAg3xAIl1Z4mAAAAABJRU5ErkJggg==")' : 'none'
            }}
          >
            {/* Zoom Wrapper (CSS zoom을 사용하여 실제 레이아웃 크기를 변경) */}
            <div 
              className="m-auto p-8 transition-all duration-75" // 💡 m-auto로 중앙 정렬 및 여백 확보
              style={{ zoom: isExporting ? 1 : zoomScale }} // 💡 캡처 시에만 100%로 강제 고정
            >
              {/* 캡처 대상 영역 */}
              <div 
                id="mermaid-capture-target" 
                className={`transition-all duration-300 flex flex-col shrink-0 ${isTransparent ? 'bg-transparent' : 'bg-[#e5e5e5]'}`}
                style={{ padding: `${padding}px` }}
              >
                {/* ... (내부 다이어그램 렌더링 로직 유지) ... */}
              <div className={`flex flex-col rounded-xl overflow-hidden ${shadowClass} ${currentTheme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                
                {/* Mac OS 스타일 타이틀바 */}
                {showWindowFrame && (
                  <div className={`flex items-center justify-between px-4 py-3 ${currentTheme === 'dark' ? 'bg-black/20' : 'bg-black/5'}`}>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className={`text-xs font-mono opacity-60 ${currentTheme === 'dark' ? 'text-white' : 'text-black'}`}>
                      Diagram
                    </div>
                  </div>
                )}
                
                {/* SVG 렌더링 영역 */}
                <div className="p-8 flex items-center justify-center min-h-[200px] min-w-[300px]">
                  {renderError ? (
                    <div className="flex flex-col items-center gap-2 text-red-500">
                      <AlertCircle className="w-8 h-8" />
                      <span className="text-sm font-medium">{renderError}</span>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center justify-center w-full [&_svg]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: svgContent }} 
                    />
                  )}
                </div>

             
            </div>
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
