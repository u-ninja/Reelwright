import { cn } from '@/lib/utils'

// Follows currentColor and font-size: dark inside gold buttons, add "text-primary text-4xl" for a gold page loader.
export function Loader({
  label = 'Loading',
  className
}: {
  label?: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('relative inline-flex h-[0.7em] w-[1.9em] overflow-hidden', className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="mr-[0.2em] h-full w-[0.5em] shrink-0 rounded-[0.1em] border border-current opacity-30"
        />
      ))}
      <span className="frame-advance absolute top-0 left-0 h-full w-[0.7em]">
        <span className="block h-full w-[0.5em] rounded-[0.1em] bg-current" />
      </span>
    </span>
  )
}
