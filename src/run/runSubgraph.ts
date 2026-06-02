import { filter, map, merge, pipe, share, tap } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexId } from '../vertex/VertexId'
import { GraphCoreInfo } from '../graph/GraphCoreInfo'
import { extractReduxState } from './extractReduxState'
import { GraphRun } from './GraphRun'
import { GraphRunData } from './RunData'
import { VertexFields } from './VertexFields'
import { runVertex } from './runVertex'
import { trackedUpstreamFieldHasChanged } from './trackedUpstreamFieldHasChanged'

export const runSubgraph = (
   config: VertexConfigImpl,
   coreInfo: GraphCoreInfo,
   getRootReduxState: () => VertexReduxState
): GraphRun =>
   pipe(
      runVertex(config, coreInfo, getRootReduxState),
      ...((
         coreInfo.vertexConfigsByClosestCommonAncestorId[config.id] || []
      ).map(
         (downstreamConfig): GraphRun =>
            data$ => {
               // root → … → downstream vertex; used to extract its own substate
               // out of the live root tree (no parent hand-down needed).
               const reduxPath =
                  coreInfo.reduxPathByVertexId[downstreamConfig.id]
               let latestInputFieldsByVertexId: Record<VertexId, VertexFields> =
                  {}
               let latestReduxState: VertexReduxState
               let latestOutputFieldsByVertexId: Record<
                  VertexId,
                  VertexFields
               > = {}

               const hasTrackedAction = (data: GraphRunData) =>
                  data.action &&
                  coreInfo.trackedActionsInSubgraph[downstreamConfig.id].some(
                     action => action.type === data.action?.type
                  )

               const maybeShouldRun$ = data$.pipe(
                  tap(data => {
                     latestInputFieldsByVertexId = data.fieldsByVertexId
                  }),
                  map(data => {
                     // Extract this subgraph's redux substate from the live root
                     // once, then reuse it for the change check here and the
                     // latestReduxState bookkeeping in runOutput$.
                     const reduxState = extractReduxState(
                        getRootReduxState(),
                        reduxPath
                     )
                     const shouldRun =
                        reduxState !== latestReduxState || // redux slice changed
                        hasTrackedAction(data) ||
                        trackedUpstreamFieldHasChanged(downstreamConfig, data)
                     return { data, reduxState, shouldRun }
                  }),
                  share()
               )

               const runOutput$ = maybeShouldRun$.pipe(
                  filter(({ shouldRun }) => shouldRun),
                  tap(({ reduxState }) => {
                     latestReduxState = reduxState
                  }),
                  map(({ data }) => data),
                  runSubgraph(downstreamConfig, coreInfo, getRootReduxState),
                  tap(output => {
                     const outputFieldsByVertexId: Record<
                        VertexId,
                        VertexFields
                     > = {}
                     coreInfo.vertexIdsInSubgraph[downstreamConfig.id].forEach(
                        vertexId => {
                           outputFieldsByVertexId[vertexId] =
                              output.fieldsByVertexId[vertexId]
                        }
                     )
                     latestOutputFieldsByVertexId = {
                        ...latestOutputFieldsByVertexId,
                        ...outputFieldsByVertexId
                     }
                  })
               )
               const notRunOutput$ = maybeShouldRun$.pipe(
                  filter(({ shouldRun }) => !shouldRun),
                  map(({ data }) => ({
                     ...data,
                     changedFieldsByVertexId: {
                        ...data.changedFieldsByVertexId,
                        [downstreamConfig.id]: {}
                     }
                  }))
               )
               return merge(runOutput$, notRunOutput$).pipe(
                  map(data => ({
                     ...data,
                     fieldsByVertexId: {
                        ...latestInputFieldsByVertexId,
                        ...latestOutputFieldsByVertexId
                     }
                  }))
               )
            }
      ) as [GraphRun])
   )
