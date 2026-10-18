import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

// Pill-shaped select used for kind, tone, format and length.
export function Chip<T extends string>({
  label,
  value,
  options,
  onChange,
  format = (o) => o
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  format?: (o: T) => string
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" className="rounded-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {format(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
