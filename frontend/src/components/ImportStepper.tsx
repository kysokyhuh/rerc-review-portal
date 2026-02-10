interface ImportStepperProps {
  currentStep: 1 | 2 | 3;
  warningsCount?: number;
}

const STEPS = [
  { id: 1, label: "Select CSV", description: "Choose a file to import." },
  { id: 2, label: "Validate & Preview", description: "Check headers and sample rows." },
  { id: 3, label: "Import Results", description: "Review inserted and failed rows." },
] as const;

export function ImportStepper({ currentStep, warningsCount = 0 }: ImportStepperProps) {
  return (
    <ol className="import-stepper" aria-label="CSV import progress">
      {STEPS.map((step) => {
        const state =
          step.id < currentStep
            ? "done"
            : step.id === currentStep
            ? "active"
            : "upcoming";
        const hasWarnings = step.id === 2 && warningsCount > 0;
        return (
          <li key={step.id} className={`import-step import-step-${state}`}>
            <span className="import-step-badge" aria-hidden="true">
              {state === "done" ? "✓" : step.id}
            </span>
            <span className="import-step-text">
              <strong>{step.label}</strong>
              <small>{step.description}</small>
              {hasWarnings && (
                <small className="import-step-warning">{warningsCount} warning(s) found</small>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
