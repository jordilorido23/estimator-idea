import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        qualified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        estimated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        declined: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
        sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: string;
}

const statusVariantMap: Record<string, string> = {
  NEW: 'new',
  QUALIFIED: 'qualified',
  ESTIMATED: 'estimated',
  DECLINED: 'declined',
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export function StatusBadge({
  status,
  size,
  className,
  ...props
}: StatusBadgeProps) {
  const variantKey = statusVariantMap[status.toUpperCase()] || 'default';

  return (
    <span
      className={cn(
        statusBadgeVariants({
          variant: variantKey as any,
          size,
        }),
        className
      )}
      {...props}
    >
      {status}
    </span>
  );
}
