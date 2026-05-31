import { createContext } from 'react'
import { Graph } from 'verdux'

export const GraphContext = createContext<Graph>(undefined as any)
