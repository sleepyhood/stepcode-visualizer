'use client';

import { Step, STEPS } from '../types';

interface StepIndicatorProps {
    activeStep: Step;
    onStepClick: (step: Step) => void;
    completedSteps: Set<Step>;
}

export default function StepIndicator({ activeStep, onStepClick, completedSteps }: StepIndicatorProps) {
    return (
        <div className="flex items-start gap-0 mb-2">
            {STEPS.map((step, index) => {
                const isActive = step.number === activeStep;
                const isDone = completedSteps.has(step.number);
                const isClickable = isDone || step.number <= activeStep;

                return (
                    <div key={step.number} className="flex items-center flex-1">
                        <button
                            onClick={() => isClickable && onStepClick(step.number)}
                            disabled={!isClickable}
                            title={step.description}
                            className={`flex flex-col items-center gap-1 flex-1 transition-all ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                        >
                            {/* 원형 아이콘 */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                ${isActive
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110'
                                    : isDone
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'bg-white border-neutral-300 text-neutral-400'
                                }`}>
                                {isDone && !isActive ? '✓' : step.number}
                            </div>
                            {/* 레이블 */}
                            <span className={`text-[9px] font-semibold leading-tight text-center
                                ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-neutral-400'}`}>
                                {step.label}
                            </span>
                        </button>
                        {/* 연결선 */}
                        {index < STEPS.length - 1 && (
                            <div className={`h-0.5 w-full mt-[-14px] transition-colors
                                ${completedSteps.has(step.number) ? 'bg-green-400' : 'bg-neutral-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
