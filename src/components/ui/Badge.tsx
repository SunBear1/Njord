type BadgeVariant = 'success' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-bg-hover text-text-secondary',
  accent: 'bg-accent-primary/10 text-accent-primary',
};

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
