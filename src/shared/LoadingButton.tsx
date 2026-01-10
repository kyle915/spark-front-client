import React from "react";
import { useFormContext } from "react-hook-form";

interface LoadingButtonProps {
    name?: string; // para integrarse con react-hook-form
    startIcon?: React.ReactNode;
    onClick?: () => void;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
    text?: string;
    type?: "button" | "submit";
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
    startIcon = null,
    onClick,
    loading = false,
    disabled = false,
    fullWidth = false,
    className = "",
    text = "",
    type = "button",
}) => {
    const methods = useFormContext();
    const isSubmitting = methods?.formState?.isSubmitting;

    const isDisabled = loading || disabled || isSubmitting;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            className={`
    btn btn-primary rounded-full font-semibold transition
    ${fullWidth ? "w-full" : ""}
    ${isDisabled ? "btn-disabled" : ""}
    ${className}
  `}
        >
            {loading || isSubmitting ? (
                <>
                    <span className="loading loading-spinner"></span>
                    {text && <span className="ml-2">{text}</span>}
                </>
            ) : (
                <>
                    {startIcon && <span className="mr-2">{startIcon}</span>}
                    {text}
                </>
            )}
        </button>
    );
};

export default LoadingButton;