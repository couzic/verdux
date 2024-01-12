import { Observable } from 'rxjs'
import { VertexType } from './VertexType'
import { PickedVertexLoadableState } from './state/PickedVertexLoadableState'
import { VertexLoadableState } from './state/VertexLoadableState'
import { VertexState, VertexStateKey } from './state/VertexState'

export interface VertexInstance<Type extends VertexType> {
   readonly name: string
   readonly id: symbol
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
   ): Observable<PickedVertexLoadableState<Type, K>>
}
