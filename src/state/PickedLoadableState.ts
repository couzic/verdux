import { VertexType } from '../VertexType'
import { VertexLoadableState } from './VertexLoadableState'
import { VertexStateKey } from './VertexState'

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
      Exclude<K & keyof Type['readonlyFields'], keyof Type['loadableFields']>
   >
   loadableFields: Pick<
      Type['loadableFields'],
      K & keyof Type['loadableFields']
   >
   dependencies: Type['dependencies']
}>
