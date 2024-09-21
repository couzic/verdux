import {
   combineLatest,
   filter,
   isObservable,
   map,
   merge,
   ReplaySubject,
   share,
   tap
} from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { pickFields } from '../state/pickFields'
import { toVertexState } from '../state/toVertexState'

export const computeFromFields$ =
   (fields: string[], computers: any): VertexRun =>
   data$ => {
      const loadingFields: VertexFields = {}
      const computedFieldNames = Object.keys(computers)
      computedFieldNames.forEach(fieldName => {
         loadingFields[fieldName] = {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })

      let inputDataReceived = false
      const inputDataReceived$ = new ReplaySubject<true>(1)
      let latestInputFields: VertexFields | undefined = undefined
      let latestOutputFields = loadingFields

      const inputFieldsMaybeChangedAndLoaded$ = data$.pipe(
         tap(data => {
            latestInputFields = data.fields
            if (inputDataReceived === false) {
               inputDataReceived = true
               inputDataReceived$.next(true)
            }
         }),
         map(data => ({
            data,
            fieldsHaveChanged: fields.some(
               fieldName => data.changedFields[fieldName] !== undefined
            ),
            fieldsAreLoaded: fields.every(
               fieldName => data.fields[fieldName].status === 'loaded'
            )
         })),
         share()
      )

      const loading$ = inputFieldsMaybeChangedAndLoaded$.pipe(
         filter(_ => _.fieldsHaveChanged),
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

      const changedLoadedInputFields$ = inputFieldsMaybeChangedAndLoaded$.pipe(
         filter(_ => _.fieldsHaveChanged),
         filter(_ => _.fieldsAreLoaded),
         map(({ data }) => pickFields(fields, data.fields)),
         map(fields => toVertexState(fields))
      )

      const computed$ = merge(
         ...computedFieldNames.map(fieldName => {
            const result$ = computers[fieldName](changedLoadedInputFields$)
            if (!isObservable(result$))
               throw new Error(
                  `Loader for value "${fieldName}" must return an observable, received "${result$}" instead.`
               )
            return combineLatest([result$, inputDataReceived$]).pipe(
               map(_ => _[0]),
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

      const passingThrough$ = inputFieldsMaybeChangedAndLoaded$.pipe(
         filter(_ => !_.fieldsHaveChanged || _.fieldsAreLoaded),
         map(({ data }) => ({
            ...data,
            fields: { ...data.fields, ...latestOutputFields }
         }))
      )

      return merge(loading$, passingThrough$, computed$)
   }
