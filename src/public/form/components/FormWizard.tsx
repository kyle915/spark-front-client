import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import WizardProgressBar from "./WizardProgressBar";

export interface WizardStep {
  title: string;
  description?: string;
  content: React.ReactNode;
  validate?: () => Promise<boolean> | boolean;
}

interface FormWizardProps {
  steps: WizardStep[];
  onSubmit: () => void;
  resetSignal?: any;
}

export default function FormWizard({
  steps,
  onSubmit,
  resetSignal,
}: FormWizardProps) {
  const [current, setCurrent] = useState(0);
  const total = steps.length;

  useEffect(() => {
    setCurrent(0);
  }, [resetSignal]);

  const next = async () => {
    const validateFn = steps[current].validate;
    if (validateFn) {
      const isValid = await validateFn();
      if (!isValid) return;
    }

    if (current < total - 1) setCurrent(current + 1);
    else onSubmit();
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  return (
    <div className="w-full md:w-[760px] mx-auto space-y-6">
      <WizardProgressBar step={current} total={total} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{steps[current].title}</h1>
          {steps[current].description && (
            <p className="opacity-60 text-sm">{steps[current].description}</p>
          )}
        </div>

        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-300
                ${i === current ? "bg-primary scale-110" : "bg-base-300"}`}
            />
          ))}
        </div>
      </div>

      <div className="relative min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.28, layout: { duration: 0.25 } }}
            className="card bg-base-100 p-8 shadow-xl rounded-2xl border border-base-300/50"
          >
            {steps[current].content}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between">
        {current > 0 ? (
          <button className="btn btn-outline" onClick={prev}>
            Back
          </button>
        ) : (
          <span />
        )}

        <button className="btn btn-primary px-8" onClick={next}>
          {current === total - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
