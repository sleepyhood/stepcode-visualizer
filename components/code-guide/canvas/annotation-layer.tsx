'use client';

import { COLOR_HEX, type AnnotationColor } from '../types';
import type { LocalRect } from './layout-utils';

export type AnchorRect = LocalRect & {
    centerX: number;
    centerY: number;
};

export interface ArtboardOverlayData {
    height: number;
    width: number;
}

export interface BoxOverlayData {
    color: AnnotationColor;
    comment?: string;
    id: string;
    index: number;
    position: {
        x: number;
        y: number;
    };
}

export interface ArrowOverlayData {
    color: AnnotationColor;
    comment?: string;
    id: string;
    index: number;
    labelPosition: {
        x: number;
        y: number;
    };
    markerId: string;
    path: string;
}

interface AnnotationLayerProps {
    artboard: ArtboardOverlayData;
    arrowOverlays: ArrowOverlayData[];
    boxOverlays: BoxOverlayData[];
}

function NumberBadge({ index, color }: { color: string; index: number }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 'bold',
                marginRight: 4,
                flexShrink: 0,
            }}
        >
            {index + 1}
        </span>
    );
}

export default function AnnotationLayer({
    artboard,
    arrowOverlays,
    boxOverlays,
}: AnnotationLayerProps) {
    if ((!boxOverlays.length && !arrowOverlays.length) || artboard.width <= 0 || artboard.height <= 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
            <svg
                className="absolute inset-0 overflow-visible"
                width={artboard.width}
                height={artboard.height}
                viewBox={`0 0 ${artboard.width} ${artboard.height}`}
            >
                <defs>
                    {arrowOverlays.map((arrow) => (
                        <marker
                            key={arrow.markerId}
                            id={arrow.markerId}
                            markerWidth="10"
                            markerHeight="10"
                            refX="8"
                            refY="5"
                            orient="auto"
                            markerUnits="strokeWidth"
                        >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR_HEX[arrow.color]} />
                        </marker>
                    ))}
                </defs>
                {arrowOverlays.map((arrow) => (
                    <path
                        key={arrow.id}
                        d={arrow.path}
                        fill="none"
                        stroke={COLOR_HEX[arrow.color]}
                        strokeDasharray="8 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        markerEnd={`url(#${arrow.markerId})`}
                    />
                ))}
            </svg>

            {boxOverlays.map((box) => (
                <div
                    key={box.id}
                    className="absolute text-xs font-sans px-2 py-0.5 rounded shadow text-white font-bold whitespace-nowrap flex items-center"
                    style={{
                        top: box.position.y,
                        left: box.position.x,
                        backgroundColor: COLOR_HEX[box.color],
                    }}
                >
                    <span className="w-3.5 h-3.5 rounded-full bg-black/20 flex items-center justify-center text-[9px] text-white font-bold mr-1 shrink-0">
                        {box.index + 1}
                    </span>
                    {box.comment}
                    <div
                        className="absolute w-1.5 h-1.5 rotate-45"
                        style={{
                            backgroundColor: COLOR_HEX[box.color],
                            bottom: '-3px',
                            left: '10px',
                        }}
                    />
                </div>
            ))}

            {arrowOverlays.map((arrow) => (
                <div
                    key={arrow.id}
                    className="absolute"
                    style={{
                        top: arrow.labelPosition.y,
                        left: arrow.labelPosition.x,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: arrow.comment ? '#1e1e1e' : 'transparent',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 'bold',
                            padding: arrow.comment ? '2px 8px' : 0,
                            borderRadius: 999,
                            whiteSpace: 'nowrap',
                            boxShadow: arrow.comment ? '0 2px 6px rgba(0,0,0,0.25)' : 'none',
                        }}
                    >
                        <NumberBadge index={arrow.index} color={COLOR_HEX[arrow.color]} />
                        {arrow.comment}
                    </div>
                </div>
            ))}
        </div>
    );
}
