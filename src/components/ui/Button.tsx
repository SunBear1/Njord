import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-primary text-white hover:bg-accent-primary/90 focus:ring-accent-primary/50',
  secondary: 'border border-accent-secondary text-accent-secondary hover:bg-accent-secondary/10 focus:ring-accent-secondary/50',
  ghost: 'text-text-secondary hover:bg-bg-hover focus:ring-accent-primary/50',
  danger: 'bg-danger text-white hover:bg-danger/90 focus:ring-danger/50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `.trim()}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
