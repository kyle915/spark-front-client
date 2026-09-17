import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

type Common = {
  children: ReactNode;
  className?: string;
};

export function SparkPrimaryButton({
  children,
  className = "",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`spark-btn-primary ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SparkPrimaryLink({
  children,
  className = "",
  ...rest
}: Common & LinkProps) {
  return (
    <Link className={`spark-btn-primary ${className}`.trim()} {...rest}>
      {children}
    </Link>
  );
}

export default SparkPrimaryButton;
