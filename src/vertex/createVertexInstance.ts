import { Observable, ReplaySubject, distinctUntilChanged, map } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexLoadableState } from '../state/VertexLoadableState'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexState } from '../state/VertexState'
import { combineFields } from '../state/combineFields'
import { compareFields } from '../state/compareFields'
import { pickLoadableState } from '../state/pickLoadableState'
import { VertexInstance } from './VertexInstance'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'

export const createVertexInstance = <
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
>(
   config: VertexConfig<Fields, Dependencies>,
   fields$: Observable<Record<string, VertexFieldState>>,
   dependencies: Dependencies
): VertexInstance<Fields, Dependencies> => {
   let currentState: VertexState<Fields>
   let currentLoadableState: VertexLoadableState<Fields>
   let state$ = new ReplaySubject<VertexState<Fields>>(1)
   let loadableState$ = new ReplaySubject<VertexLoadableState<Fields>>(1)
   fields$.subscribe(fields => {
      currentLoadableState = combineFields(fields)
      currentState = currentLoadableState.state
      loadableState$.next(currentLoadableState)
      state$.next(currentState)
   })
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
         return loadableState$.pipe(
            map(loadableState =>
               pickLoadableState(loadableState, fields as any)
            ),
            map(_ => _.fields),
            distinctUntilChanged(compareFields),
            map(combineFields)
         ) as any
      }
   }
}
