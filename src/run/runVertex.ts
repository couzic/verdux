import { map } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphRun } from './GraphRun'
import { GraphRunData, VertexRunData } from './RunData'
import { VertexFields } from './VertexFields'
import { compareVertexFields } from './compareVertexFields'
import { extractVertexFields } from './extractVertexFields'

export const runVertex = (
   config: VertexConfigImpl,
   dependencies: any = {}
): GraphRun => {
   const extractFields = extractVertexFields(config)
   return data$ => {
      let latestInput: {
         graphRunData: GraphRunData
         fields: VertexFields
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
               graphRunData: data,
               fields
            }
            return {
               action: data.action,
               fields,
               changedFields,
               fieldsReactions: data.fieldsReactions,
               reactions: data.reactions,
               initialRun: data.initialRun
            }
         }),
         ...config.getInjectedOperations(dependencies),
         map(
            (data): GraphRunData => ({
               action: data.action,
               fieldsReactions: data.fieldsReactions,
               reactions: data.reactions,
               reduxStateByVertexId:
                  latestInput.graphRunData.reduxStateByVertexId,
               fieldsByVertexId: {
                  ...latestInput.graphRunData.fieldsByVertexId,
                  [config.id]: data.fields
               },
               changedFieldsByVertexId: {
                  ...latestInput.graphRunData.changedFieldsByVertexId,
                  [config.id]: data.changedFields
               },
               initialRun: data.initialRun
            })
         )
      )
   }
}
