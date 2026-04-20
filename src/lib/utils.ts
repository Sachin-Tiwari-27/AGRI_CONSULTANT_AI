import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function formatCurrency(amount: number, currency = 'OMR'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function parseGPS(coords: string): { lat: number; lon: number } | null {
  // Handle "25.1234, 55.5678" or Google Maps link
  const match = coords.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/)
  if (!match) return null
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) }
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  call_scheduled: 'Call Scheduled',
  call_completed: 'Call Completed',
  questionnaire_sent: 'Questionnaire Sent',
  questionnaire_submitted: 'Questionnaire Submitted',
  clarification_sent: 'Clarification Sent',
  analysis_running: 'Analysis Running',
  report_draft: 'Report Draft',
  report_review: 'Report In Review',
  report_published: 'Report Published',
  payment_pending: 'Payment Pending',
  completed: 'Completed',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  call_scheduled: 'bg-blue-100 text-blue-800',
  call_completed: 'bg-blue-100 text-blue-800',
  questionnaire_sent: 'bg-amber-100 text-amber-800',
  questionnaire_submitted: 'bg-amber-100 text-amber-800',
  clarification_sent: 'bg-orange-100 text-orange-800',
  analysis_running: 'bg-purple-100 text-purple-800',
  report_draft: 'bg-purple-100 text-purple-800',
  report_review: 'bg-purple-100 text-purple-800',
  report_published: 'bg-green-100 text-green-800',
  payment_pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
}
