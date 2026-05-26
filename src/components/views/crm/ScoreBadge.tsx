import { scoreColor } from '@/lib/rfm'

export default function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold"
      style={{ background: `${scoreColor(score)}20`, color: scoreColor(score) }}
    >
      {score}
    </span>
  )
}
