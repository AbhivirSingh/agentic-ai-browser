import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function validateProductName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100
}

export function validateMethods(methods: string[]): { valid: boolean; errors: string[] } {
  const validMethods = ["scrapybara", "playwright", "puppeteer"]
  const errors: string[] = []

  if (!Array.isArray(methods) || methods.length === 0) {
    errors.push("At least one scraping method is required")
  }

  const invalidMethods = methods.filter((method) => !validMethods.includes(method))
  if (invalidMethods.length > 0) {
    errors.push(`Invalid methods: ${invalidMethods.join(", ")}. Valid methods are: ${validMethods.join(", ")}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function calculateProgress(completedSteps: number, totalSteps: number, phase: "scraping" | "analysis"): number {
  const baseProgress = (completedSteps / totalSteps) * (phase === "scraping" ? 80 : 20)
  return Math.round(baseProgress + (phase === "analysis" ? 80 : 0))
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "")
}

export function isValidSessionId(sessionId: string): boolean {
  return /^session-\d+-[a-z0-9]+$/.test(sessionId)
}
