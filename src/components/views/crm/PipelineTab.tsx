'use client'
import { FollowUpTask } from '@/lib/types'
import { SEGMENT_CONFIG } from '@/lib/rfm'
import { X } from 'lucide-react'

interface Props {
  tasks: FollowUpTask[]
  todayStr: string
  onDeleteTask: (id: string) => void
  onUpdateStatus: (id: string, status: FollowUpTask['status']) => void
}

const STATUS_LABELS: Record<FollowUpTask['status'], { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#F59E0B' },
  ongoing: { label: 'On Going', color: '#3B82F6' },
  done: { label: 'Done', color: '#10B981' },
}

export default function PipelineTab({ tasks, todayStr, onDeleteTask, onUpdateStatus }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(['todo', 'ongoing', 'done'] as FollowUpTask['status'][]).map(status => {
        const colTasks = tasks.filter(t => t.status === status)
        const { label, color } = STATUS_LABELS[status]
        return (
          <div key={status} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-semibold" style={{ color }}>{label}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{colTasks.length}</span>
            </div>
            <div className="p-3 space-y-2 min-h-32">
              {colTasks.length === 0 && (
                <p className="text-center text-xs py-8" style={{ color: '#374151' }}>Tidak ada task</p>
              )}
              {colTasks.map(task => {
                const segCfg = SEGMENT_CONFIG[task.segment]
                const isOverdue = task.dueDate < todayStr && task.status !== 'done'
                return (
                  <div key={task.id} className="rounded-xl p-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{task.customerName}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: segCfg.bg, color: segCfg.color }}>{task.segment}</span>
                      </div>
                      <button onClick={() => onDeleteTask(task.id)} style={{ color: '#374151' }}><X size={12} /></button>
                    </div>
                    <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>{task.note}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: isOverdue ? '#EF4444' : '#4B5563' }}>
                        📅 {task.dueDate}{isOverdue ? ' — Overdue!' : ''}
                      </span>
                      <div className="flex gap-1">
                        {status !== 'todo' && <button onClick={() => onUpdateStatus(task.id, status === 'ongoing' ? 'todo' : 'ongoing')} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F9FAFB', color: '#6B7280' }}>←</button>}
                        {status !== 'done' && <button onClick={() => onUpdateStatus(task.id, status === 'todo' ? 'ongoing' : 'done')} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F9FAFB', color: '#6B7280' }}>→</button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
