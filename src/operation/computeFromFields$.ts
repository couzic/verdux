import {
   catchError,
   combineLatest,
   filter,
   isObservable,
   map,
   merge,
   of,
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

      // Fields whose computer stream errored terminally. Such a branch is dead
      // and will never emit again, so on subsequent input changes we keep the
      // field in `error` rather than resetting it to `loading` — otherwise it
      // would be stranded in a perpetual loading state. (Mirrors loadFromFields$.)
      const deadFields: VertexFields = {}

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
            const reloadingFields: VertexFields = {}
            const changedLoadingFields: VertexChangedFields = {}
            computedFieldNames.forEach(fieldName => {
               const deadField = deadFields[fieldName]
               if (deadField !== undefined) {
                  // Terminally errored: keep it in error, don't reload.
                  reloadingFields[fieldName] = deadField
               } else {
                  reloadingFields[fieldName] = loadingFields[fieldName]
                  if (
                     data.initialRun ||
                     latestOutputFields[fieldName].status !== 'loading'
                  ) {
                     changedLoadingFields[fieldName] = true
                  }
               }
            })
            latestOutputFields = reloadingFields
            return {
               ...data,
               fields: { ...data.fields, ...reloadingFields },
               changedFields: { ...data.changedFields, ...changedLoadingFields }
            }
         })
      )

      const changedLoadedInputFields$ = inputFieldsMaybeChangedAndLoaded$.pipe(
         filter(_ => _.fieldsHaveChanged),
         filter(_ => _.fieldsAreLoaded),
         map(({ data }) => pickFields(fields, data.fields)),
         map(fields => toVertexState(fields)),
         // Shared & future-only: a `catchError` resubscribe (below) must not
         // replay the input value that just made the computer throw, or it would
         // loop forever on a synchronously-erroring computer.
         share()
      )

      const computed$ = merge(
         ...computedFieldNames.map(fieldName => {
            const result$ = computers[fieldName](changedLoadedInputFields$)
            if (!isObservable(result$))
               throw new Error(
                  `Computer for value "${fieldName}" must return an observable, received "${result$}" instead.`
               )
            const emitOutput = (): VertexRunData => ({
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
            return combineLatest([result$, inputDataReceived$]).pipe(
               map(_ => _[0]),
               tap(result => {
                  // A successful recompute clears any prior dead-branch error so
                  // `loading$` resumes its normal loading behavior for this field.
                  delete deadFields[fieldName]
                  latestOutputFields = {
                     ...latestOutputFields,
                     [fieldName]: {
                        status: 'loaded',
                        value: result,
                        errors: []
                     }
                  }
               }),
               map((): VertexRunData => emitOutput()),
               // A computer error becomes an error field for THAT field only,
               // leaving the merged stream (and every other field) alive. We
               // record it in `deadFields` so `loading$` keeps it in error on
               // later input changes instead of resetting it to `loading`, then
               // resubscribe (returning `caught`) to the shared, future-only
               // input so a LATER valid input still recomputes the field. The
               // `share()` above guarantees the erroring value is not replayed.
               catchError((error, caught) => {
                  const errorField = {
                     status: 'error' as const,
                     value: undefined,
                     errors: [error]
                  }
                  deadFields[fieldName] = errorField
                  latestOutputFields = {
                     ...latestOutputFields,
                     [fieldName]: errorField
                  }
                  return merge(of(emitOutput()), caught)
               })
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
