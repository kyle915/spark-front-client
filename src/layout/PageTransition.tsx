import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { canStartViewTransition, ROUTE_VIEW_TRANSITION_MS } from "./routeViewTransition";

/**
 * 140ms subtle opacity cross-fade fallback for browsers without native
 * `document.startViewTransition` (and sub-route switches within a hub).
 * When native View Transitions handle the hub cross-fade or reduced motion
 * is requested, renders at opacity 1 without double-fading.
 */
const fastVariants: Variants = {
  initial: { opacity: 0.88 },
  animate: {
    opacity: 1,
    transition: {
      duration: ROUTE_VIEW_TRANSITION_MS / 1000,
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
  const nativeVtSupported = canStartViewTransition();
  const variants =
    reduceMotion || nativeVtSupported ? instantVariants : fastVariants;

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
