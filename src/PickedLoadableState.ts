import { VertexLoadableState } from './VertexLoadableState'
import { VertexStateKey } from './VertexState'
import { VertexType } from './VertexType'

export type PickedLoadableState<
   Type extends VertexType,
   K extends VertexStateKey<Type>
> = VertexLoadableState<{
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
