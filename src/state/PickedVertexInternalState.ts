import { VertexType } from '../VertexType'
import { VertexInternalState } from './VertexInternalState'
import { VertexStateKey } from './VertexState'

export type PickedVertexInternalState<
   Type extends VertexType,
   K extends VertexStateKey<Type>
> = VertexInternalState<{
   reduxState: Pick<
      Type['reduxState'],
      Exclude<K, keyof Type['readonlyFields'] | keyof Type['loadableFields']>
   >
   readonlyFields: Pick<
      Type['readonlyFields'],
      Exclude<K, keyof Type['loadableFields']>
   >
   loadableFields: Pick<Type['loadableFields'], K>
   dependencies: Type['dependencies']
}>
