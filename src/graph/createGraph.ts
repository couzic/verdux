import { Middleware, UnknownAction, configureStore } from '@reduxjs/toolkit'
import { Subject } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectableConfig } from '../config/VertexInjectableConfig'
import { GraphRunData } from '../run/RunData'
import { runSubgraph } from '../run/runSubgraph'
import { createFIFO } from '../util/FIFO'
import { VertexId } from '../vertex/VertexId'
import { VertexInstance } from '../vertex/VertexInstance'
import { createVertexInstance } from '../vertex/createVertexInstance'
import { Graph } from './Graph'
import { computeGraphCore } from './computeGraphCore'

export const createGraph = (options: {
   vertices: Array<VertexInjectableConfig<any>>
   devtools?: (params: any) => void
}): Graph => {
   const graphConfig = computeGraphCore(options.vertices)
   const { vertexConfigs, rootReducer } = graphConfig

   // TODO
   // const epicMiddleware: Middleware = createEpicMiddleware()

   const graphRunInput$: Subject<GraphRunData> = new Subject()

   const rootVertexConfig = vertexConfigs[0]

   const verduxMiddleware: Middleware = store => next => action => {
      const result = next(action)
      const reduxState = store.getState()
      graphRunInput$.next({
         action: action as UnknownAction,
         reduxStateByVertexId: {
            [rootVertexConfig.id]: reduxState
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {},
         fieldsReactions: [],
         reactions: []
      })
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

   const graphRunOutput$ = runSubgraph(
      rootVertexConfig as VertexConfigImpl,
      graphConfig
   )(graphRunInput$)

   const fieldsReactionsFIFO = createFIFO<UnknownAction>()
   const reactionsFIFO = createFIFO<UnknownAction>()

   const vertexInstanceById: Record<VertexId, VertexInstance<any, any>> = {}
   vertexConfigs.forEach(config => {
      // TODO Dependencies
      vertexInstanceById[config.id] = createVertexInstance(config, {})
   })

   graphRunOutput$.subscribe(data => {
      data.fieldsReactions.forEach(_ => fieldsReactionsFIFO.push(_))
      data.reactions.forEach(_ => reactionsFIFO.push(_))
      if (fieldsReactionsFIFO.hasNext()) {
         reduxStore.dispatch(fieldsReactionsFIFO.pop()!)
      } else if (reactionsFIFO.hasNext()) {
         reduxStore.dispatch(reactionsFIFO.pop()!)
      } else {
         vertexConfigs.forEach(config => {
            const fields = data.fieldsByVertexId[config.id]
            const changedFields = data.changedFieldsByVertexId[config.id]
            vertexInstanceById[config.id].__pushFields(fields, changedFields)
         })
      }
   })

   graphRunInput$.next({
      action: undefined,
      reduxStateByVertexId: {
         [rootVertexConfig.id]: reduxStore.getState()
      },
      fieldsByVertexId: {},
      changedFieldsByVertexId: {},
      fieldsReactions: [],
      reactions: []
   })

   // TODO
   // const epics = [] as any[]

   const graph: Graph = {
      dispatch: (action: UnknownAction) => reduxStore.dispatch(action),
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
