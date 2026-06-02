import { map } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphCoreInfo } from '../graph/GraphCoreInfo'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexId } from '../vertex/VertexId'
import { GraphRun } from './GraphRun'
import { GraphRunData, VertexRunData } from './RunData'
import { VertexChangedFields, VertexFields } from './VertexFields'
import { compareVertexFields } from './compareVertexFields'
import { extractVertexFields } from './extractVertexFields'

export const runVertex = (
   config: VertexConfigImpl,
   graphCoreInfo: GraphCoreInfo,
   getRootReduxState: () => VertexReduxState
): GraphRun => {
   const extractFields = extractVertexFields(
      config,
      graphCoreInfo,
      getRootReduxState
   )
   return data$ => {
      // Captures only the parts of the last input that the output map reuses —
      // the field maps to merge this vertex's output into, and `fields` for the
      // next change comparison. Notably *not* the redux root: a partial run must
      // read the live root (see the output map below), so retaining a captured
      // root here would only invite the stale-root reads ARCHITECTURE.md §6 rules out.
      let latestInput: {
         fields: VertexFields
         fieldsByVertexId: Record<VertexId, VertexFields>
         changedFieldsByVertexId: Record<VertexId, VertexChangedFields>
      }
      return data$.pipe(
         map((data): VertexRunData => {
            const fields = extractFields(data)
            // TODO Optimize : get changed fields from upstream data
            const changedFields = compareVertexFields(
               latestInput?.fields,
               fields
            )
            latestInput = {
               fields,
               fieldsByVertexId: data.fieldsByVertexId,
               changedFieldsByVertexId: data.changedFieldsByVertexId
            }
            return {
               action: data.action,
               fields,
               changedFields,
               fieldsReactions: data.fieldsReactions,
               reactions: data.reactions,
               sideEffects: data.sideEffects,
               initialRun: data.initialRun
            }
         }),
         ...graphCoreInfo.operationsByVertexId[config.id],
         map(
            (data): GraphRunData => ({
               action: data.action,
               fieldsReactions: data.fieldsReactions,
               reactions: data.reactions,
               sideEffects: data.sideEffects,
               fieldsByVertexId: {
                  ...latestInput.fieldsByVertexId,
                  [config.id]: data.fields
               },
               changedFieldsByVertexId: {
                  ...latestInput.changedFieldsByVertexId,
                  [config.id]: data.changedFields
               },
               initialRun: data.initialRun
            })
         )
      )
   }
}
