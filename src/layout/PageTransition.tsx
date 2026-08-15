import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.6, 1],
    },
  },
};

export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  // No mode="wait": waiting for the exit animation unmounts the page
  // (and its Layout) before the next route paints, which is what made
  // navigations flash a blank/LOADING screen for seconds.
  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
