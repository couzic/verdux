import { Middleware, UnknownAction, configureStore } from '@reduxjs/toolkit'
import { Subject } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectableConfig } from '../config/VertexInjectableConfig'
import { VerduxDevTools } from '../devtools/VerduxDevTools'
import { serializeGraphRunOutput } from '../devtools/serializeGraphRunOutput'
import { serializeGraphStructure } from '../devtools/serializeGraphStructure'
import { GraphRunData } from '../run/RunData'
import { runSubgraph } from '../run/runSubgraph'
import { createFIFO } from '../util/FIFO'
import { VertexId } from '../vertex/VertexId'
import { VertexInstance } from '../vertex/VertexInstance'
import { createVertexInstance } from '../vertex/createVertexInstance'
import { Graph } from './Graph'
import { computeGraphCoreInfo } from './computeGraphCoreInfo'

export const createGraph = (options: {
   vertices: Array<VertexInjectableConfig<any>>
   devtools?: VerduxDevTools
}): Graph => {
   const { devtools } = options

   const coreInfo = computeGraphCoreInfo(options.vertices)
   const { vertexConfigs, rootReducer } = coreInfo
   if (devtools) {
      const graphStructure = serializeGraphStructure(coreInfo)
      devtools.sendGraphStructure(graphStructure)
   }

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
         reactions: [],
         sideEffects: [],
         initialRun: false
      })
      return result
   }

   const reduxStore = configureStore({
      reducer: rootReducer,
      // TODO Remove thunk ?
      middleware: getDefaultMiddleware =>
         getDefaultMiddleware().concat(verduxMiddleware)
   })

   const graphRunOutput$ = runSubgraph(
      rootVertexConfig as VertexConfigImpl,
      coreInfo
   )(graphRunInput$)

   const fieldsReactionsFIFO = createFIFO<UnknownAction>()
   const reactionsFIFO = createFIFO<UnknownAction>()
   const sideEffectsFIFO = createFIFO<() => void>()

   const vertexInstanceById: Record<VertexId, VertexInstance<any, any>> = {}
   vertexConfigs.forEach(config => {
      // TODO Dependencies
      vertexInstanceById[config.id] = createVertexInstance(config, {})
   })
   if (devtools) {
      devtools.provideForceGraphRunOutput((runOutput: GraphRunData) => {
         vertexConfigs.forEach(config => {
            const fields = runOutput.fieldsByVertexId[config.id]
            const fieldNames = Object.keys(fields)
            const changedFields: Record<string, true> = {}
            fieldNames.forEach(fieldName => {
               changedFields[fieldName] = true
            })
            vertexInstanceById[config.id].__pushFields(fields, changedFields)
         })
      })
   }

   let savedChangedFieldsByVertexId: Record<VertexId, Record<string, any>> = {}
   const saveChangedFields = (data: GraphRunData) => {
      const changedFields = data.changedFieldsByVertexId
      Object.keys(changedFields).forEach(vertexId => {
         if (savedChangedFieldsByVertexId[vertexId] === undefined) {
            savedChangedFieldsByVertexId[vertexId] = {}
         }
         savedChangedFieldsByVertexId[vertexId] = {
            ...savedChangedFieldsByVertexId[vertexId],
            ...changedFields[vertexId]
         }
      })
   }
   graphRunOutput$.subscribe(data => {
      if (devtools) {
         const serializedOutput = serializeGraphRunOutput(data)
         devtools.sendGraphRunOutput(serializedOutput)
      }
      data.fieldsReactions.forEach(_ => fieldsReactionsFIFO.push(_))
      data.reactions.forEach(_ => reactionsFIFO.push(_))
      data.sideEffects.forEach(_ => sideEffectsFIFO.push(_))
      if (fieldsReactionsFIFO.hasNext()) {
         saveChangedFields(data)
         reduxStore.dispatch(fieldsReactionsFIFO.pop()!)
      } else if (reactionsFIFO.hasNext()) {
         saveChangedFields(data)
         reduxStore.dispatch(reactionsFIFO.pop()!)
      } else {
         vertexConfigs.forEach(config => {
            const fields = data.fieldsByVertexId[config.id]
            const changedFields = {
               ...savedChangedFieldsByVertexId[config.id],
               ...data.changedFieldsByVertexId[config.id]
            }
            vertexInstanceById[config.id].__pushFields(fields, changedFields)
         })
         savedChangedFieldsByVertexId = {}
         while (sideEffectsFIFO.hasNext()) {
            const sideEffect = sideEffectsFIFO.pop()!
            sideEffect()
         }
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
      reactions: [],
      sideEffects: [],
      initialRun: true
   })

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

   return graph
}
