import { Middleware, UnknownAction, configureStore } from '@reduxjs/toolkit'
import { createEpicMiddleware } from 'redux-observable'
import { ReplaySubject, Subject, map } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectableConfig } from '../config/VertexInjectableConfig'
import { VertexFieldState } from '../state/VertexFieldState'
import { createFIFO } from '../util/FIFO'
import { VertexId } from '../vertex/VertexId'
import { VertexInstance } from '../vertex/VertexInstance'
import { createVertexInstance } from '../vertex/createVertexInstance'
import { Graph } from './Graph'
import { GraphData } from './GraphData'
import { GraphSeed } from './GraphSeed'
import { GraphTransformable } from './GraphTransformable'
import { computeGraphCore } from './computeGraphCore'
import { emitVertexFieldStates } from './emitVertexFieldStates'

export const createGraph = (options: {
   vertices: Array<VertexInjectableConfig<any>>
   devtools?: (params: any) => void
}): Graph => {
   const graphConfig = computeGraphCore(options.vertices)
   const {
      vertexIds,
      vertexConfigById,
      dependenciesByVertexId,
      rootReducer,
      pipeline
   } = graphConfig

   const vertexConfigs = vertexIds.map(id => vertexConfigById[id])

   const epicMiddleware: Middleware = createEpicMiddleware()

   const redux$: Subject<GraphSeed> = new Subject()

   const verduxMiddleware: Middleware = store => next => action => {
      const result = next(action)
      const reduxState = store.getState()
      redux$.next({ reduxState, action: action as UnknownAction })
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

   const graphData$ = pipeline(redux$)

   const fieldsReactionsFIFO = createFIFO<UnknownAction>()
   const reactionsFIFO = createFIFO<UnknownAction>()

   const vertexFieldStatesStreamById: Record<
      VertexId,
      Subject<Record<string, VertexFieldState>>
   > = {}
   const vertexInstanceById: Record<VertexId, VertexInstance<any, any>> = {}
   vertexConfigs.forEach(config => {
      const fields$ = new ReplaySubject<Record<string, VertexFieldState>>(1)
      vertexFieldStatesStreamById[config.id] = fields$
      vertexInstanceById[config.id] = createVertexInstance(config, fields$, {})
      // TODO Dependencies
   })

   const outputGraphData$ = new Subject<GraphData>()
   graphData$.subscribe(({ graphData }) => {
      graphData.fieldsReactions.forEach(_ => fieldsReactionsFIFO.push(_))
      graphData.reactions.forEach(_ => reactionsFIFO.push(_))
      if (fieldsReactionsFIFO.hasNext()) {
         reduxStore.dispatch(fieldsReactionsFIFO.pop()!)
      } else if (reactionsFIFO.hasNext()) {
         reduxStore.dispatch(reactionsFIFO.pop()!)
      } else {
         outputGraphData$.next(graphData)
         // TODO Side effects
      }
   })
   emitVertexFieldStates(
      outputGraphData$,
      vertexFieldStatesStreamById,
      vertexIds
   )

   redux$.next({ reduxState: reduxStore.getState() })

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
