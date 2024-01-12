import { VertexType } from '../VertexType'
import { VertexStateKey } from './VertexState'

export type PickedVertexLoadedState<
   Type extends VertexType,
   PickedKey extends VertexStateKey<Type>
> = {
   [K in PickedKey]: K extends keyof Type['loadableFields']
      ? Type['loadableFields'][K]
      : K extends keyof Type['readonlyFields']
        ? Type['readonlyFields'][K]
        : K extends keyof Type['reduxState']
          ? Type['reduxState'][K]
          : never
}
