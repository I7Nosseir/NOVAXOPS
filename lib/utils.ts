import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PipelineStage, Priority, SocialPlatform, User, UserRole } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'strategy', 'ideas', 'calendar', 'copy', 'design',
  'review', 'approval', 'scheduled', 'published', 'reporting',
]

export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string; border: string }> = {
  strategy:  { label: 'Strategy',  color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  ideas:     { label: 'Ideas',     color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  calendar:  { label: 'Calendar',  color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  copy:      { label: 'Copy',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  design:    { label: 'Design',    color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  review:    { label: 'Review',    color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  approval:  { label: 'Approval',  color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200' },
  scheduled: { label: 'Scheduled', color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  published: { label: 'Published', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  reporting: { label: 'Reporting', color: 'text-slate-700',   bg: 'bg-slate-100',  border: 'border-slate-200' },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: 'text-slate-600',  bg: 'bg-slate-100' },
  medium: { label: 'Medium', color: 'text-amber-700',  bg: 'bg-amber-100' },
  high:   { label: 'High',   color: 'text-orange-700', bg: 'bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-700',    bg: 'bg-red-100' },
}

export const PLATFORM_CONFIG: Record<SocialPlatform, { label: string; color: string }> = {
  instagram: { label: 'Instagram',   color: '#E1306C' },
  facebook:  { label: 'Facebook',    color: '#1877F2' },
  linkedin:  { label: 'LinkedIn',    color: '#0A66C2' },
  tiktok:    { label: 'TikTok',      color: '#000000' },
  twitter:   { label: 'X (Twitter)', color: '#14171A' },
  youtube:   { label: 'YouTube',     color: '#FF0000' },
  pinterest: { label: 'Pinterest',   color: '#E60023' },
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}
