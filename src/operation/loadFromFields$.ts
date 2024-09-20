import { filter, isObservable, map, merge, share, tap } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { pickFields } from '../state/pickFields'
import { toVertexState } from '../state/toVertexState'

export const loadFromFields$ =
   (fields: string[], loaders: any): VertexRun =>
   data$ => {
      const loadingFields: VertexFields = {}
      const loadableFieldNames = Object.keys(loaders)
      loadableFieldNames.forEach(fieldName => {
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
            fieldsHaveChanged: fields.some(
               fieldName => data.changedFields[fieldName] !== undefined
            )
         })),
         share()
      )

      const inputFieldsHaveChanged$ = inputFieldsMaybeChanged$.pipe(
         filter(_ => _.fieldsHaveChanged),
         share()
      )

      const loading$ = inputFieldsHaveChanged$.pipe(
         map(({ data }): VertexRunData => {
            const changedLoadingFields: VertexChangedFields = {}
            loadableFieldNames.forEach(fieldName => {
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
         filter(({ data }) =>
            fields.every(
               fieldName => data.fields[fieldName].status === 'loaded'
            )
         ),
         map(({ data }) => pickFields(fields, data.fields)),
         map(fields => toVertexState(fields)),
         share()
      )

      const loaded$ = merge(
         ...loadableFieldNames.map(fieldName => {
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

      return merge(loading$, loaded$, passingThrough$)
   }
