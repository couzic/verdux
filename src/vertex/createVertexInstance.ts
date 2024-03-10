import { Observable, ReplaySubject, distinctUntilChanged, map } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexLoadableState } from '../old/state/VertexLoadableState'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexState } from '../state/VertexState'
import { combineFields } from '../state/combineFields'
import { compareFields } from '../state/compareFields'
import { pickLoadableState } from '../state/pickLoadableState'
import { VertexInstance } from './VertexInstance'
import { VertexType } from './VertexType'

export const createVertexInstance = <Type extends VertexType>(
   config: VertexConfig<Type>,
   fields$: Observable<Record<string, VertexFieldState>>,
   dependencies: Type['dependencies']
): VertexInstance<Type> => {
   let currentState: VertexState<Type>
   let currentLoadableState: VertexLoadableState<Type>
   let state$ = new ReplaySubject<VertexState<Type>>(1)
   let loadableState$ = new ReplaySubject<VertexLoadableState<Type>>(1)
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
