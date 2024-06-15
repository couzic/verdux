import { GraphRunData } from '../run/RunData'
import { SerializedGraphRunOutput } from './SerializedGraphRunOutput'
import { SerializedGraphStructure } from './SerializedGraphStructure'

export interface VerduxDevTools {
   sendGraphStructure: (graphStructure: SerializedGraphStructure) => void
   sendGraphRunOutput: (graphRunOutput: SerializedGraphRunOutput) => void
   provideForceGraphRunOutput(
      forceGraphRunOutput: (runOutput: GraphRunData) => void
   ): void
}
