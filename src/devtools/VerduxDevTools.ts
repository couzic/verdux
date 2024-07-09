import { GraphRunData } from '../run/RunData'
import { SerializedGraphRunData } from './SerializedGraphRunData'
import { SerializedGraphStructure } from './SerializedGraphStructure'

export interface VerduxDevTools {
   sendGraphStructure: (graphStructure: SerializedGraphStructure) => void
   sendGraphRunOutput: (graphRunOutput: GraphRunData) => void
   provideForceGraphRunOutput(
      forceGraphRunOutput: (runOutput: GraphRunData) => void
   ): void
   provideSerializeGraphRunData(
      serializeGraphRunData: (runData: GraphRunData) => SerializedGraphRunData
   ): void
}
