import { VertexType } from '../vertex/VertexType'
import { VertexStateKey } from './VertexState'

export type PickedLoadedVertexState<
   Type extends VertexType,
   PickedKey extends VertexStateKey<Type>
> = {
   [K in PickedKey]: K extends keyof Type['fields']
      ? K extends keyof Type['loadableFields']
         ? never // KEY CLASH PREVENTION. TODO implement runtime behavior ?
         : Type['fields'][K]
      : K extends keyof Type['loadableFields']
        ? Type['loadableFields'][K]
        : never
}
