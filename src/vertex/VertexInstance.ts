import { Observable } from 'rxjs'
import { VertexLoadableState } from '../old/state/VertexLoadableState'
import { PickedLoadedVertexState } from '../state/PickedLoadedVertexState'
import { VertexState, VertexStateKey } from '../state/VertexState'
import { VertexId } from './VertexId'
import { VertexType } from './VertexType'

export interface VertexInstance<Type extends VertexType> {
   readonly name: string
   readonly id: VertexId
   readonly currentState: {
      [K in keyof VertexState<Type>]: VertexState<Type>[K]
   }
   readonly state$: Observable<{
      [K in keyof VertexState<Type>]: VertexState<Type>[K]
   }>
   readonly currentLoadableState: {
      [K in keyof VertexLoadableState<Type>]: VertexLoadableState<Type>[K]
   }
   readonly loadableState$: Observable<{
      [K in keyof VertexLoadableState<Type>]: VertexLoadableState<Type>[K]
   }>
   readonly dependencies: Type['dependencies']
   pick<K extends VertexStateKey<Type>>(
      fields: K[]
   ): Observable<PickedLoadedVertexState<Type, K>>
}
