import type React from "react"
export interface ScrapingSession {
  id: string
  productName: string
  method: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  data?: ProductData
  logs: string[]
  startTime: Date
  endTime?: Date
}

export interface ComparisonResult {
  id: string
  product1: string
  product2: string
  scrapingResults: {
    product1: ProductData
    product2: ProductData
  }
  comparison: string
  readme: string
  timestamp: Date
}

export interface ProductData {
  name: string
  price: string
  rating: string
  features: string[]
  specifications: Record<string, string>
  reviews: number
  availability: string
  source: string
}

export interface BrowserMethod {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export interface SessionData {
  id: string
  product1: string
  product2: string
  methods: string[]
  status: "running" | "completed" | "failed"
  progress: number
  results?: {
    scrapingResults: Record<string, Record<string, ProductData>>
    comparison: string
    readme: string
  }
  logs: string[]
  startTime: Date
  endTime?: Date
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: "info" | "warning" | "error" | "success"
  source: string
  message: string
  metadata?: Record<string, any>
}

export interface MaximLoggerProps {
  sessionId?: string
  isActive: boolean
}
