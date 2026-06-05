import { Middleware, UnknownAction, configureStore } from '@reduxjs/toolkit'
import { Subject } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectableConfig } from '../config/VertexInjectableConfig'
import { VerduxDevTools } from '../devtools/VerduxDevTools'
import { VerduxLogger, reportError } from './VerduxLogger'
import { serializeGraphRunData } from '../devtools/serializeGraphRunData'
import { serializeGraphStructure } from '../devtools/serializeGraphStructure'
import { GraphRunData } from '../run/RunData'
import { runSubgraph } from '../run/runSubgraph'
import { createFIFO } from '../util/FIFO'
import { VertexId } from '../vertex/VertexId'
import { InternalVertexInstance } from '../vertex/InternalVertexInstance'
import { VertexInstance } from '../vertex/VertexInstance'
import { createVertexInstance } from '../vertex/createVertexInstance'
import { Graph } from './Graph'
import { computeGraphCoreInfo } from './computeGraphCoreInfo'

export const createGraph = (options: {
   vertices: Array<VertexInjectableConfig<any>>
   devtools?: VerduxDevTools
   logger?: VerduxLogger
   excludeDefaultReduxMiddleware?: boolean
}): Graph => {
   const { devtools, logger } = options

   const coreInfo = computeGraphCoreInfo(options.vertices, logger)
   const { vertexConfigs, rootReducer } = coreInfo
   if (devtools) {
      const graphStructure = serializeGraphStructure(coreInfo)
      devtools.sendGraphStructure(graphStructure)
   }

   const graphRunInput$: Subject<GraphRunData> = new Subject()

   const rootVertexConfig = vertexConfigs[0]

   const verduxMiddleware: Middleware = store => next => action => {
      const result = next(action)
      graphRunInput$.next({
         action: action as UnknownAction,
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
         options.excludeDefaultReduxMiddleware
            ? ([verduxMiddleware] as any)
            : getDefaultMiddleware().concat(verduxMiddleware)
   })

   const graphRunOutput$ = runSubgraph(
      rootVertexConfig as VertexConfigImpl,
      coreInfo,
      () => reduxStore.getState()
   )(graphRunInput$)

   const fieldsReactionsFIFO = createFIFO<UnknownAction>()
   const reactionsFIFO = createFIFO<UnknownAction>()
   const sideEffectsFIFO = createFIFO<() => void>()

   const vertexInstanceById: Record<
      VertexId,
      InternalVertexInstance<any, any>
   > = {}
   vertexConfigs.forEach(config => {
      vertexInstanceById[config.id] = createVertexInstance(
         config,
         coreInfo.dependenciesByVertexId[config.id]
      )
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
      devtools.provideSerializeGraphRunData(serializeGraphRunData)
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
   graphRunOutput$.subscribe({
      next: data => {
         if (devtools) {
            devtools.sendGraphRunOutput(data)
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
      },
      // Observability only — deliberately NOT a recovery path. An error reaching
      // here means a throw escaped every per-operation guard, so we no longer
      // understand the graph's state; resubscribing would keep the app running on
      // possibly-inconsistent state. We fail fast instead: the subscription that
      // drives the whole graph terminates and stops publishing. This handler's
      // sole job is to make that death traceable rather than silent: without an
      // `error` callback an escaped throw freezes published state with no
      // diagnostic while Redux keeps mutating. If this ever fires,
      // it is a bug: find the unguarded throw site and add a per-operation guard.
      error: error => {
         reportError(
            logger,
            '[verdux] a graph run threw an error that escaped all ' +
               'operation-level handling. The graph has STOPPED and will no ' +
               'longer publish state updates (dispatches will still mutate ' +
               'Redux but vertices will not react). This is a bug — please ' +
               'report it. Originating error:',
            error
         )
      }
   })

   graphRunInput$.next({
      action: undefined,
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
         return vertexInstance as VertexInstance<any, any>
      }
   }

   return graph
}
