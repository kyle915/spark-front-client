import { useEffect, useRef } from "react";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmButtonClass?: string;
}

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmButtonClass = "btn-primary",
}: ConfirmationModalProps) => {
    const modalRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;

        if (isOpen) {
            modal.showModal();
        } else {
            modal.close();
        }
    }, [isOpen]);

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    return (
        <dialog ref={modalRef} className="modal" onClose={onClose}>
            <div className="modal-box">
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="py-4">{message}</p>
                <div className="modal-action">
                    <button
                        type="button"
                        className="btn"
                        onClick={handleCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`btn ${confirmButtonClass}`}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button type="button" onClick={handleCancel}>close</button>
            </form>
        </dialog>
    );
};

export default ConfirmationModal;
