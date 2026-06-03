interface StepProgressProps {
  currentStep: number;
  totalSteps?: number;
  labels?: string[];
}

export function StepProgress({
  currentStep,
  totalSteps = 3,
  labels = ['Identificação', 'Áreas de Atuação', 'Alertas'],
}: StepProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isDone = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isDone ? 'bg-accent text-white' : '',
                  isActive ? 'bg-primary ring-primary/20 text-white ring-4' : '',
                  !isDone && !isActive ? 'bg-gray-100 text-gray-400' : '',
                ].join(' ')}
              >
                {isDone ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={[
                  'whitespace-nowrap text-xs font-medium',
                  isActive ? 'text-primary' : 'text-gray-400',
                ].join(' ')}
              >
                {labels[i]}
              </span>
            </div>

            {i < totalSteps - 1 && (
              <div
                className={[
                  'mb-5 h-0.5 w-16 transition-colors',
                  isDone ? 'bg-accent' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
