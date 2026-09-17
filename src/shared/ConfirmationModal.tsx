import type { ReactNode } from "react";
import SparkConfirm from "./SparkConfirm";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Kept for callers; danger tone when class includes error/warning. */
  confirmButtonClass?: string;
  children?: ReactNode;
}

/**
 * Legacy confirm API — now backed by SparkOverlay / SparkConfirm.
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "btn-primary",
  children,
}: ConfirmationModalProps) => {
  if (!isOpen) return null;

  const tone =
    confirmButtonClass.includes("error") ||
    confirmButtonClass.includes("warning") ||
    confirmButtonClass.includes("danger")
      ? "danger"
      : "default";

  return (
    <SparkConfirm
      title={title}
      body={
        <>
          <p>{message}</p>
          {children}
        </>
      }
      confirmLabel={confirmText}
      cancelLabel={cancelText}
      tone={tone}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
};

export default ConfirmationModal;
