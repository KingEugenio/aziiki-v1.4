import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMinimumLoadingTime } from "../hooks/useMinimumLoadingTime";

interface LoadingSwapProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  /** Minimum time the skeleton stays visible once shown, in ms. Only ever
   * extends a wait that's already happening - never adds delay on top of a
   * load that was already slower than this. */
  minMs?: number;
}

/**
 * Crossfades between a skeleton and real content, gated by
 * useMinimumLoadingTime so the swap never flashes. Built on `motion`
 * (already a project dependency for the vendor-motion bundle, previously
 * unused anywhere in src/) rather than hand-rolled CSS transition classes,
 * since AnimatePresence handles the exit-before-unmount timing that a plain
 * conditional render can't.
 */
export function LoadingSwap({ isLoading, skeleton, children, minMs = 600 }: LoadingSwapProps) {
  const showSkeleton = useMinimumLoadingTime(isLoading, minMs);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showSkeleton ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(3px)" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, filter: "blur(3px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
