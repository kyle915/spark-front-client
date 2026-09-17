import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

type Common = {
  children: ReactNode;
  className?: string;
};

export function SparkGhostButton({
  children,
  className = "",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`spark-btn-ghost ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SparkGhostLink({
  children,
  className = "",
  ...rest
}: Common & LinkProps) {
  return (
    <Link className={`spark-btn-ghost ${className}`.trim()} {...rest}>
      {children}
    </Link>
  );
}

export default SparkGhostButton;
