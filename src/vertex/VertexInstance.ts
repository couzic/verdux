import { Observable } from 'rxjs'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { PickedLoadableVertexState } from '../state/PickedLoadableVertexState'
import { VertexLoadableState } from '../state/VertexLoadableState'
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
   readonly currentLoadableState: VertexLoadableState<Fields>
   readonly loadableState$: Observable<VertexLoadableState<Fields>>
   readonly dependencies: Dependencies
   pick<K extends keyof Fields>(
      fields: K[]
   ): Observable<PickedLoadableVertexState<Fields, K>>
   __pushFields(
      fields: VertexFields,
      changedFields: VertexChangedFields | undefined
   ): void
}
