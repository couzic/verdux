import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'

export type PickedLoadedVertexState<
   Fields extends VertexFieldsDefinition,
   PickedKey extends keyof Fields
> = {
   [K in PickedKey]: Fields[K]['value']
}
