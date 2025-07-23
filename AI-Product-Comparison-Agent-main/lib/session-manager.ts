// Shared session manager for both API routes
class SessionManager {
  private sessions = new Map<string, any>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Only start cleanup in server environment
    if (typeof window === "undefined") {
      this.startCleanup()
    }
  }

  private startCleanup() {
    // Cleanup old sessions every 30 minutes
    this.cleanupInterval = setInterval(
      () => {
        const now = new Date()
        for (const [id, session] of this.sessions.entries()) {
          const age = now.getTime() - session.startTime.getTime()
          if (age > 30 * 60 * 1000) {
            // 30 minutes
            this.sessions.delete(id)
            console.log(`Cleaned up expired session: ${id}`)
          }
        }
      },
      30 * 60 * 1000,
    )
  }

  set(id: string, session: any) {
    this.sessions.set(id, session)
  }

  get(id: string) {
    return this.sessions.get(id)
  }

  has(id: string) {
    return this.sessions.has(id)
  }

  delete(id: string) {
    return this.sessions.delete(id)
  }

  clear() {
    this.sessions.clear()
  }

  size() {
    return this.sessions.size
  }

  // Get all session IDs for debugging
  getAllSessionIds() {
    return Array.from(this.sessions.keys())
  }

  // Get session stats
  getStats() {
    const now = new Date()
    let active = 0
    let completed = 0
    let failed = 0

    for (const session of this.sessions.values()) {
      switch (session.status) {
        case "running":
          active++
          break
        case "completed":
          completed++
          break
        case "failed":
          failed++
          break
      }
    }

    return {
      total: this.sessions.size,
      active,
      completed,
      failed,
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()
