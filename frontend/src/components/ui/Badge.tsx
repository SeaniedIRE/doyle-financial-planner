import clsx from 'clsx'

const typeMap: Record<string, string> = {
  TFSA: 'badge-tfsa',
  RRSP: 'badge-rrsp',
  FHSA: 'badge-fhsa',
  LIRA: 'badge-lira',
  Margin: 'badge-margin',
  Cash: 'badge-cash',
  'Joint Non-Reg': 'badge-joint',
}

export default function Badge({ type }: { type: string }) {
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', typeMap[type] ?? 'badge-cash')}>
      {type}
    </span>
  )
}
