export interface Player {
  id: string
  score: number
}

export interface Simulation {
  majorNoveltyCount?: number
  lastNoveltyTimestamp?: number
}

export interface InterventionLog {
  playerId: string
  simulationId: string
  timestamp: number
  actionType: string
  parameters?: Record<string, unknown>
}
