import { AnyAction } from '@reduxjs/toolkit'
import { Observable } from 'rxjs'
import { PickedLoadableState } from './PickedLoadableState'
import { VertexLoadableState } from './VertexLoadableState'
import { VertexState, VertexStateKey } from './VertexState'
import { VertexType } from './VertexType'

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
   ): Observable<PickedLoadableState<Type, K>>
}
