import {
   Middleware,
   Reducer,
   UnknownAction,
   combineReducers,
   configureStore
} from '@reduxjs/toolkit'
import { createEpicMiddleware } from 'redux-observable'
import {
   Observable,
   ReplaySubject,
   Subject,
   distinctUntilChanged,
   map
} from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectedConfig } from '../config/VertexInjectedConfig'
import { createVertexInstance } from '../vertex/createVertexInstance'
import { createFIFO } from '../util/FIFO'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexId } from '../vertex/VertexId'
import { VertexInstance } from '../vertex/VertexInstance'
import { Graph } from './Graph'
import { GraphData } from './GraphData'
import { emitVertexFieldStates as emitVertexFieldStates } from './emitVertexFieldStates'
import { computeGraphConfig } from './computeGraphConfig'

export const createGraph = (options: {
   vertices: Array<VertexInjectedConfig<any>>
   devtools?: (params: any) => void
}): Graph => {
   const graphConfig = computeGraphConfig(options.vertices)

   const exhaustiveVertexConfigs = graphConfig.vertexIds.map(
      id => graphConfig.vertexConfigById[id]
   )

   ///////////////////////////////////////////////
   // Index vertex configs by upstream reducer //
   /////////////////////////////////////////////

   const vertexConfigsByUpstreamReducerId: Record<
      symbol,
      Array<VertexConfig<any>>
   > = {}

   exhaustiveVertexConfigs.forEach(config => {
      const closestCommonAncestorId = (
         config as VertexConfigImpl<any>
      ).findClosestCommonAncestor()
      if (config.id === closestCommonAncestorId) return // It's the root vertex
      if (!vertexConfigsByUpstreamReducerId[closestCommonAncestorId]) {
         vertexConfigsByUpstreamReducerId[closestCommonAncestorId] = []
      }
      vertexConfigsByUpstreamReducerId[closestCommonAncestorId].push(config)
   })

   /////////////////////////
   // Create Redux store //
   ///////////////////////

   const createReduxReducer = (
      vertexConfig: VertexConfig<any>
   ): Reducer<any> => {
      const downstreamVertexConfigs =
         vertexConfigsByUpstreamReducerId[vertexConfig.id] || []
      if (downstreamVertexConfigs.length === 0)
         return combineReducers({ vertex: vertexConfig.reducer })

      const downstreamReducersByName = {} as Record<string, Reducer<any>>
      downstreamVertexConfigs.forEach(config => {
         downstreamReducersByName[config.name] = createReduxReducer(config)
      })
      return combineReducers({
         vertex: vertexConfig.reducer,
         downstream: combineReducers(downstreamReducersByName)
      })
   }

   const rootVertexConfig = exhaustiveVertexConfigs[0]
      .rootVertex as VertexConfigImpl<any>
   const rootReducer = createReduxReducer(rootVertexConfig)

   const epicMiddleware: Middleware = createEpicMiddleware()

   const reduxFIFO = createFIFO<{ state: any; action: unknown }>()

   const verduxMiddleware: Middleware = store => next => action => {
      const result = next(action)
      const state = store.getState()
      reduxFIFO.push({ state, action })
      return result
   }

   const reduxStore = configureStore({
      reducer: rootReducer,
      // TODO Remove thunk ?
      middleware: getDefaultMiddleware =>
         getDefaultMiddleware().concat(verduxMiddleware)
      // middleware: getDefaultMiddleware =>
      // TODO epics
      //    getDefaultMiddleware().concat(epicMiddleware)
   })

   reduxStore.subscribe(() => {
      redux$.next(reduxFIFO.pop()!)
   })

   const redux$: Subject<{ state: any; action?: unknown }> = new Subject()
   const inputGraphData$ = redux$.pipe(
      map(({ state, action }): { graphData: GraphData; action?: unknown } => {
         const rootVertexReduxState = state.vertex
         const fields = {} as Record<string, VertexFieldState>
         Object.keys(rootVertexReduxState).forEach(key => {
            fields[key] = {
               status: 'loaded',
               value: rootVertexReduxState[key],
               errors: []
            }
         })
         return {
            graphData: {
               vertices: {
                  [rootVertexConfig.id]: {
                     reduxState: state,
                     fields
                  }
               },
               fieldsReactions: [],
               reactions: []
            },
            action
         }
      })
   )
   // TODO Add all vertices in graph data
   // TODO Apply transformations for each vertex IN CORRECT ORDER
   // TODO Make sure a transformation is called only if its upstream vertex has changed
   const transformed$ = inputGraphData$.pipe(map(data => data))

   const fieldsReactionsFIFO = createFIFO<UnknownAction>()
   const reactionsFIFO = createFIFO<UnknownAction>()

   const vertexFieldStatesStreamById: Record<
      VertexId,
      Subject<Record<string, VertexFieldState>>
   > = {}
   const vertexInstanceById: Record<VertexId, VertexInstance<any, any>> = {}
   exhaustiveVertexConfigs.forEach(config => {
      const fields$ = new ReplaySubject<Record<string, VertexFieldState>>(1)
      vertexFieldStatesStreamById[config.id] = fields$
      vertexInstanceById[config.id] = createVertexInstance(config, fields$, {})
      // TODO Dependencies
   })

   const outputGraphData$ = new Subject<GraphData>() // TODO USE !!!!!!!!!!!!!
   transformed$.subscribe(({ graphData }) => {
      graphData.fieldsReactions.forEach(_ => fieldsReactionsFIFO.push(_))
      graphData.reactions.forEach(_ => reactionsFIFO.push(_))
      if (reduxFIFO.hasNext()) {
         redux$.next(reduxFIFO.pop()!)
      } else if (fieldsReactionsFIFO.hasNext()) {
         reduxStore.dispatch(fieldsReactionsFIFO.pop()!)
      } else if (reactionsFIFO.hasNext()) {
         reduxStore.dispatch(reactionsFIFO.pop()!)
      } else {
         outputGraphData$.next(graphData)
         // TODO Side effects
      }
   })
   emitVertexFieldStates(outputGraphData$, vertexFieldStatesStreamById, [
      // TODO exhaustiveVertexIds SORTED !!!
      rootVertexConfig.id
   ])

   redux$.next({ state: reduxStore.getState() })

   const epics = [] as any[]

   const dispatch = (action: UnknownAction) => {
      reduxStore.dispatch(action)
   }

   const graph: Graph = {
      dispatch,
      getVertexInstance: (vertexConfig: VertexConfig<any>) => {
         const vertexInstance = vertexInstanceById[vertexConfig.id]
         if (!vertexInstance)
            throw new Error(
               'No vertex found for id ' +
                  vertexConfig.id.toString() +
                  '. Did you forget to register it ?'
            )
         return vertexInstance
      }
   }

   // TODO Dev Tools
   // if (options.devtools) {
   //    options.devtools({
   //       graph,
   //       exhaustiveVertexConfigs
   //    })
   // }

   return graph
}

///////////////////
// sideEffect() //
/////////////////
// ;(config as VertexConfigImpl<Type>).sideEffects.forEach(sideEffect => {
//    epics.push(
//       mergeMap((action: UnknownAction) => {
//          if (action.type === sideEffect.actionCreator.type) {
//             sideEffect.operation(action.payload, vertex)
//          }
//          return NEVER
//       })
//    )
// })

/////////////////
// reaction() //
///////////////
// ;(config as VertexConfigImpl<Type>).reactions.forEach(reaction => {
//    const epic = (action$: Observable<UnknownAction>) =>
//       reaction.operation(
//          action$.pipe(
//             ofType(reaction.actionCreator.type),
//             map(_ => _.payload)
//          ),
//          vertex
//       )
//    epics.push(epic)
// })
// return vertex
