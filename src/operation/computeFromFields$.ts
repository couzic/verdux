import { filter, isObservable, map, merge, share, tap } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { pickFields } from '../state/pickFields'
import { toVertexState } from '../state/toVertexState'

export const computeFromFields$ =
   (fields: string[], loaders: any): VertexRun =>
   data$ => {
      const loadingFields: VertexFields = {}
      const computedFieldNames = Object.keys(loaders)
      computedFieldNames.forEach(fieldName => {
         loadingFields[fieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })

      let latestInputFields: VertexFields | undefined = undefined
      let latestOutputFields = loadingFields

      const inputFieldsMaybeChanged$ = data$.pipe(
         tap(data => (latestInputFields = data.fields)),
         map(data => ({
            data,
            fieldsHaveChanged: !fields.every(
               fieldName => data.changedFields[fieldName] === undefined
            )
         })),
         share()
      )

      const inputFieldsHaveChanged$ = inputFieldsMaybeChanged$.pipe(
         filter(_ => _.fieldsHaveChanged),
         map(_ => ({
            ..._,
            fieldsAreLoaded: fields.every(
               fieldName => _.data.fields[fieldName].status === 'loaded'
            )
         })),
         share()
      )

      const loading$ = inputFieldsHaveChanged$.pipe(
         filter(_ => !_.fieldsAreLoaded),
         map(({ data }): VertexRunData => {
            const changedLoadingFields: VertexChangedFields = {}
            computedFieldNames.forEach(fieldName => {
               if (
                  data.initialRun ||
                  latestOutputFields[fieldName].status !== 'loading'
               ) {
                  changedLoadingFields[fieldName] = true
               }
            })
            return {
               ...data,
               fields: { ...data.fields, ...loadingFields },
               changedFields: { ...data.changedFields, ...changedLoadingFields }
            }
         }),
         tap(() => (latestOutputFields = loadingFields))
      )

      const changedLoadedInputFields$ = inputFieldsHaveChanged$.pipe(
         filter(_ => _.fieldsAreLoaded),
         map(({ data }) => pickFields(fields, data.fields)),
         map(fields => toVertexState(fields)),
         share()
      )

      const computed$ = merge(
         ...computedFieldNames.map(fieldName => {
            const result$ = loaders[fieldName](changedLoadedInputFields$)
            if (!isObservable(result$))
               throw new Error(
                  `Loader for value "${fieldName}" must return an observable, received "${result$}" instead.`
               )
            return result$.pipe(
               // TODO Handle error
               tap(result => {
                  latestOutputFields = {
                     ...latestOutputFields,
                     [fieldName]: {
                        status: 'loaded',
                        value: result,
                        errors: []
                     }
                  }
               }),
               map(
                  (): VertexRunData => ({
                     action: undefined,
                     initialRun: false,
                     reactions: [],
                     fieldsReactions: [],
                     sideEffects: [],
                     fields: {
                        ...latestInputFields,
                        ...latestOutputFields
                     },
                     changedFields: {
                        [fieldName]: true
                     }
                  })
               )
            )
         })
      )

      const passingThrough$ = inputFieldsMaybeChanged$.pipe(
         filter(_ => !_.fieldsHaveChanged),
         map(({ data }) => ({
            ...data,
            fields: { ...data.fields, ...latestOutputFields }
         }))
      )

      return merge(loading$, computed$, passingThrough$)
   }
