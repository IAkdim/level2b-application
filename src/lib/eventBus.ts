type Handler = () => void

class EventBus {
  private handlers: Record<string, Handler[]> = {}

  on(event: string, handler: Handler) {
    this.handlers[event] = this.handlers[event] || []
    this.handlers[event].push(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: Handler) {
    this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== handler)
  }

  emit(event: string) {
    for (const h of this.handlers[event] || []) h()
  }
}

export const eventBus = new EventBus()
