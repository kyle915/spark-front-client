import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

/**
 * Short opacity-only transition. The old 350ms + y-slide made every
 * cached nav feel laggy after the data-path speed work landed.
 */
const fastVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.12,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: [0.4, 0, 0.6, 1],
    },
  },
};

const instantVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 1, transition: { duration: 0 } },
};

export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion ? instantVariants : fastVariants;

  // No mode="wait": waiting for the exit animation unmounts the page
  // (and its Layout) before the next route paints, which is what made
  // navigations flash a blank/LOADING screen for seconds.
  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
