import { map } from 'rxjs'
import { VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { compareVertexFields } from '../run/compareVertexFields'
import { VertexState } from '../state/VertexState'
import { combineFields } from '../state/combineFields'
import { pickFields } from '../state/pickFields'

export const computeFromFields =
   (fields: string[], computers: any): VertexRun =>
   data$ => {
      let latestComputedFields: VertexFields | undefined
      const computedFieldNames = Object.keys(computers)
      const computeLoadedFields = (state: VertexState<any>) => {
         const computedFields: VertexFields = {}
         computedFieldNames.forEach(computedFieldName => {
            try {
               const computingResult = computers[computedFieldName](state)
               computedFields[computedFieldName] = {
                  status: 'loaded',
                  value: computingResult,
                  errors: []
               }
            } catch (error: any) {
               computedFields[computedFieldName] = {
                  status: 'error',
                  value: undefined,
                  errors: [error]
               }
            }
         })
         return computedFields
      }
      const loadingFields: VertexFields = {}
      computedFieldNames.forEach(computedFieldName => {
         loadingFields[computedFieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      const computeErrorFields = (errors: Error[]) => {
         const errorFields: VertexFields = {}
         computedFieldNames.forEach(computedFieldName => {
            errorFields[computedFieldName] = {
               status: 'error',
               value: undefined,
               errors
            }
         })
         return errorFields
      }
      return data$.pipe(
         map(data => {
            const hasChanged = fields.some(
               fieldName => data.changedFields[fieldName]
            )
            if (hasChanged) {
               const picked = pickFields(fields, data.fields)
               const combined = combineFields(picked)
               const computedFields =
                  combined.status === 'loaded'
                     ? computeLoadedFields(combined.state)
                     : combined.status === 'loading'
                       ? loadingFields
                       : computeErrorFields(combined.errors)
               const changedComputedFields = compareVertexFields(
                  latestComputedFields,
                  computedFields
               )
               latestComputedFields = computedFields
               return {
                  ...data,
                  fields: {
                     ...data.fields,
                     ...computedFields
                  },
                  changedFields: {
                     ...data.changedFields,
                     ...changedComputedFields
                  }
               }
            } else {
               return {
                  ...data,
                  fields: {
                     ...data.fields,
                     ...latestComputedFields
                  }
               }
            }
         })
      )
   }
