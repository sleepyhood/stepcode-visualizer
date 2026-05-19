'use client';

import { useState } from 'react';
import { Eye, EyeOff, Trash2, Edit2, Check, X } from 'lucide-react';
import { Annotation, COLOR_BG_CLASS } from '../types';

interface ReviewPanelProps {
    annotations: Annotation[];
    onToggleVisibility: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdateComment: (id: string, comment: string) => void;
    onNext: () => void;
    onPrev: () => void;
}

export default function ReviewPanel({
    annotations,
    onToggleVisibility,
    onDelete,
    onUpdateComment,
    onNext,
    onPrev,
}: ReviewPanelProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');

    const startEdit = (anno: Annotation) => {
        setEditingId(anno.id);
        setEditDraft(anno.comment ?? '');
    };

    const commitEdit = () => {
        if (editingId) {
            onUpdateComment(editingId, editDraft);
            setEditingId(null);
        }
    };

    const cancelEdit = () => setEditingId(null);

    return (
        <div className="flex flex-col gap-3">
            {/* 통계 */}
            <div className="flex gap-2 text-[10px]">
                <span className="px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-500 font-medium">
                    전체 {annotations.length}개
                </span>
                <span className="px-2 py-0.5 bg-green-100 rounded-full text-green-600 font-medium">
                    표시 {annotations.filter(a => a.visible).length}개
                </span>
            </div>

            {/* 어노테이션 목록 */}
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
                {annotations.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-6">
                        등록된 가이드라인이 없습니다.<br />
                        <span className="text-[10px]">이전 단계로 돌아가 AI에게 분석을 요청하세요.</span>
                    </p>
                ) : (
                    annotations.map((anno) => (
                        <div
                            key={anno.id}
                            className={`rounded-lg border text-xs transition-all ${anno.visible ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}
                        >
                            {/* 헤더 행 */}
                            <div className="flex items-center gap-2 px-2.5 py-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_BG_CLASS[anno.color]}`} />
                                <span className="font-mono font-bold uppercase text-[9px] bg-neutral-100 px-1 py-0.5 rounded text-neutral-500">
                                    {anno.type}
                                </span>
                                <span className="truncate text-neutral-600 flex-1 font-medium text-[11px]">
                                    {anno.from.text}
                                    {anno.to && <span className="text-neutral-400"> → {anno.to.text}</span>}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        onClick={() => startEdit(anno)}
                                        className="p-1 hover:bg-blue-50 rounded text-neutral-400 hover:text-blue-500 transition-colors"
                                        title="설명 편집"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => onToggleVisibility(anno.id)}
                                        className="p-1 hover:bg-neutral-100 rounded text-neutral-400 transition-colors"
                                        title={anno.visible ? '숨기기' : '표시'}
                                    >
                                        {anno.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </button>
                                    <button
                                        onClick={() => onDelete(anno.id)}
                                        className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-500 transition-colors"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* 설명 편집 인라인 폼 */}
                            {editingId === anno.id ? (
                                <div className="px-2.5 pb-2 flex gap-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editDraft}
                                        onChange={(e) => setEditDraft(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                        placeholder="설명 문구를 입력하세요..."
                                        className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                    />
                                    <button onClick={commitEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600">
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={cancelEdit} className="p-1 bg-neutral-200 text-neutral-600 rounded hover:bg-neutral-300">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : anno.comment ? (
                                <p className="px-2.5 pb-2 text-[10px] text-neutral-500 leading-tight">{anno.comment}</p>
                            ) : null}
                        </div>
                    ))
                )}
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={onPrev}
                    className="flex-1 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                    ← 뒤로
                </button>
                <button
                    onClick={onNext}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                >
                    다음: 내보내기 →
                </button>
            </div>
        </div>
    );
}
