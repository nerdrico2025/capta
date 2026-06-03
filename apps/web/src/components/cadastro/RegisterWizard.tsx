'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Step1 } from './Step1';
import { Step2 } from './Step2';
import { Step3 } from './Step3';
import { StepProgress } from './StepProgress';
import { useOrg } from '@/context/OrgContext';
import { registerOrganization, saveAlertPreferences } from '@/lib/api';
import type { OscProfile } from '@/types/api';

interface WizardState {
  cnpj: string;
  name: string;
  osc: OscProfile | null;
  areas: string[];
}

export function RegisterWizard() {
  const router = useRouter();
  const { setOrg } = useOrg();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, setState] = useState<WizardState>({
    cnpj: '',
    name: '',
    osc: null,
    areas: [],
  });

  function handleStep1(cnpj: string, osc: OscProfile | null, name: string) {
    setState((prev) => ({ ...prev, cnpj, osc, name, areas: osc?.areas ?? [] }));
    setStep(2);
  }

  function handleStep2(areas: string[]) {
    setState((prev) => ({ ...prev, areas }));
    setStep(3);
  }

  async function handleStep3(email: string, days: (1 | 7 | 15)[]) {
    setIsSaving(true);
    setSaveError(null);

    try {
      const org = await registerOrganization({
        cnpj: state.cnpj,
        name: state.name,
        size: state.osc?.size,
        areas: state.areas,
        city: state.osc?.city,
        state: state.osc?.state,
      });

      if (email) {
        await saveAlertPreferences({
          cnpj: state.cnpj,
          email,
          areas: state.areas,
          days,
        });
      }

      setOrg({
        cnpj: state.cnpj,
        name: org.name,
        areas: state.areas,
        isOnboarded: true,
      });

      router.push('/');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const stepTitle = ['Identifique sua organização', 'Áreas de atuação', 'Configure seus alertas'][
    step - 1
  ];

  const stepSubtitle = [
    'Informe o CNPJ para encontrarmos sua OSC no Mapa das OSCs (IPEA).',
    'Escolha as áreas para receber oportunidades relevantes.',
    'Receba alertas antes que os prazos se encerrem.',
  ][step - 1];

  return (
    <div className="mx-auto w-full max-w-lg">
      <StepProgress currentStep={step} />

      <div className="shadow-card mt-8 rounded-2xl bg-white p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-900">{stepTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{stepSubtitle}</p>
        </div>

        {step === 1 && <Step1 initialCnpj={state.cnpj} onNext={handleStep1} />}

        {step === 2 && (
          <Step2 initialAreas={state.areas} onNext={handleStep2} onBack={() => setStep(1)} />
        )}

        {step === 3 && (
          <>
            <Step3
              orgName={state.name}
              onComplete={handleStep3}
              onBack={() => setStep(2)}
              isLoading={isSaving}
            />
            {saveError && <p className="mt-3 text-center text-sm text-red-500">{saveError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
