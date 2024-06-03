import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexLoadableState } from './VertexLoadableState'

export type PickedLoadableVertexState<
   Fields extends VertexFieldsDefinition,
   PickedKey extends keyof Fields
> = VertexLoadableState<{ [K in PickedKey]: Fields[K] }>
