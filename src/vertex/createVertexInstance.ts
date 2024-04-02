import { ReplaySubject, filter, map } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexChangedFields } from '../run/VertexFields'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { VertexState } from '../state/VertexState'
import { combineFields } from '../state/combineFields'
import { pickLoadableState } from '../state/pickLoadableState'
import { VertexInstance } from './VertexInstance'

export const createVertexInstance = <
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
>(
   config: VertexConfig<Fields, Dependencies>,
   dependencies: Dependencies
): VertexInstance<Fields, Dependencies> => {
   let lastPushed:
      | {
           loadableState: VertexLoadableState<Fields>
           changedFields: VertexChangedFields
        }
      | undefined = undefined
   const pushed$ = new ReplaySubject<{
      loadableState: VertexLoadableState<Fields>
      changedFields: VertexChangedFields
   }>(1)
   let currentState: VertexState<Fields>
   let currentLoadableState: VertexLoadableState<Fields>
   let state$ = pushed$.pipe(map(_ => _.loadableState.state))
   let loadableState$ = pushed$.pipe(map(_ => _.loadableState))
   return {
      id: config.id,
      name: config.name,
      dependencies,
      get state$() {
         return state$
      },
      get loadableState$() {
         return loadableState$
      },
      get currentState() {
         return currentState
      },
      get currentLoadableState() {
         return currentLoadableState
      },
      pick(fields) {
         return pushed$.pipe(
            filter(_ =>
               fields.some(field => Boolean(_.changedFields[field as string]))
            ),
            map(_ => pickLoadableState(_.loadableState, fields as any)),
            map(_ => combineFields(_.fields))
         ) as any
      },
      __pushFields(fields, changedFields) {
         if (!changedFields || Object.keys(changedFields).length === 0) {
            if (lastPushed !== undefined) {
               return
            }
         }
         lastPushed = {
            loadableState: combineFields(fields),
            changedFields: { ...changedFields }
         }
         currentState = lastPushed.loadableState.state
         currentLoadableState = lastPushed.loadableState
         pushed$.next(lastPushed)
      }
   }
}