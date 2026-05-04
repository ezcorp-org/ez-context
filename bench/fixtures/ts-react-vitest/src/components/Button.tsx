import React from "react";

interface ButtonProps {
  onClick: () => void;
  label: string;
  variant?: "primary" | "secondary";
}

export function Button({ onClick, label, variant = "primary" }: ButtonProps) {
  const buttonClass = `btn btn-${variant}`;

  return (
    <button className={buttonClass} onClick={onClick}>
      {label}
    </button>
  );
}
