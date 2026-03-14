import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBuild } from '../../BuildContext';
import StepIndicator from './steps/StepIndicator';
import Step1Type from './steps/Step1Type';
import Step2Config from './steps/Step2Config';
import Step3Features from './steps/Step3Features';
import Step4Review from './steps/Step4Review';
import Button from '../shared/Button';

const STEPS = [Step1Type, Step2Config, Step3Features, Step4Review];

export default function ContractWizard({ onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { state } = useBuild();

  const StepComponent = STEPS[currentStep];

  function canAdvance() {
    if (currentStep === 0) return !!state.contractType;
    if (currentStep === 1) {
      const cfg = state.contractConfig;
      return cfg.contractName || cfg.tokenName || cfg.currencyName;
    }
    return true;
  }

  return (
    <div className="mb-animate-in">
      <button className="mb-back-btn" onClick={currentStep === 0 ? onBack : () => setCurrentStep(s => s - 1)}>
        <ChevronLeft size={16} />
        {currentStep === 0 ? 'Back to Templates' : 'Back'}
      </button>

      <StepIndicator current={currentStep} />

      <StepComponent />

      {currentStep < STEPS.length - 1 && (
        <div className="mb-flex mb-justify-between mb-mt-lg">
          <div />
          <Button
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={!canAdvance()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
