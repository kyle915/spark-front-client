import { motion } from "framer-motion";

interface Props {
  step: number;
  total: number;
}

export default function WizardProgressBar({ step, total }: Props) {
  const percentage = ((step + 1) / total) * 100;

  return (
    <div className="w-full mb-6">
      <div
        className="bg-base-300 rounded-full overflow-hidden"
        style={{ height: 12 }}
      >
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
      <p className="text-xs opacity-70 mt-2">
        Step {step + 1} of {total}
      </p>
    </div>
  );
}
