import { SerializedGraphRunOutput } from './SerializedGraphRunOutput'
import { SerializedGraphStructure } from './SerializedGraphStructure'

export interface VerduxDevTools {
   sendGraphStructure: (graphStructure: SerializedGraphStructure) => void
   sendGraphRunOutput: (graphRunOutput: SerializedGraphRunOutput) => void
}
