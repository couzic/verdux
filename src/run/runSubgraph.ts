import { filter, map, merge, pipe, share, tap } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexId } from '../vertex/VertexId'
import { GraphCoreInfo } from '../graph/GraphCoreInfo'
import { GraphRun } from './GraphRun'
import { GraphRunData } from './RunData'
import { VertexFields } from './VertexFields'
import { runVertex } from './runVertex'
import { trackedUpstreamFieldHasChanged } from './trackedUpstreamFieldHasChanged'

export const runSubgraph = (
   config: VertexConfigImpl,
   coreInfo: GraphCoreInfo
): GraphRun =>
   pipe(
      runVertex(config, coreInfo),
      ...((
         coreInfo.vertexConfigsByClosestCommonAncestorId[config.id] || []
      ).map(
         (downstreamConfig): GraphRun =>
            data$ => {
               let latestInputFieldsByVertexId: Record<VertexId, VertexFields> =
                  {}
               let latestReduxState: VertexReduxState
               let latestOutputFieldsByVertexId: Record<
                  VertexId,
                  VertexFields
               > = {}
               const input$ = data$.pipe(
                  tap(data => {
                     latestInputFieldsByVertexId = data.fieldsByVertexId
                  }),
                  map(data => ({
                     ...data,
                     reduxStateByVertexId: {
                        ...data.reduxStateByVertexId,
                        [downstreamConfig.id]:
                           data.reduxStateByVertexId[config.id].downstream[
                              downstreamConfig.name
                           ]
                     }
                  }))
               )

               const reduxStateHasChanged = (data: GraphRunData) =>
                  data.reduxStateByVertexId[downstreamConfig.id] !==
                  latestReduxState
               const hasTrackedAction = (data: GraphRunData) =>
                  data.action &&
                  coreInfo.trackedActionsInSubgraph[downstreamConfig.id].some(
                     action => action.type === data.action?.type
                  )
               const subgraphShouldRun = (data: GraphRunData) =>
                  reduxStateHasChanged(data) ||
                  hasTrackedAction(data) ||
                  trackedUpstreamFieldHasChanged(downstreamConfig, data)
               const maybeShouldRun$ = input$.pipe(
                  map(data => ({
                     data,
                     shouldRun: subgraphShouldRun(data)
                  })),
                  share()
               )

               const runOutput$ = maybeShouldRun$.pipe(
                  filter(({ shouldRun }) => shouldRun),
                  map(({ data }) => data),
                  tap(data => {
                     latestReduxState =
                        data.reduxStateByVertexId[downstreamConfig.id]
                  }),
                  runSubgraph(downstreamConfig, coreInfo),
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
