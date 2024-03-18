import { Observable } from 'rxjs'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { PickedLoadedVertexState } from '../state/PickedLoadedVertexState'
import { VertexState } from '../state/VertexState'
import { VertexId } from './VertexId'

export interface VertexInstance<
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
> {
   readonly name: string
   readonly id: VertexId
   readonly currentState: {
      [K in keyof VertexState<Fields>]: VertexState<Fields>[K]
   }
   readonly state$: Observable<{
      [K in keyof VertexState<Fields>]: VertexState<Fields>[K]
   }>
   readonly currentLoadableState: {
      [K in keyof VertexLoadableState<Fields>]: VertexLoadableState<Fields>[K]
   }
   readonly loadableState$: Observable<{
      [K in keyof VertexLoadableState<Fields>]: VertexLoadableState<Fields>[K]
   }>
   readonly dependencies: Dependencies
   pick<K extends keyof Fields>(
      fields: K[]
   ): Observable<PickedLoadedVertexState<Fields, K>>
}
