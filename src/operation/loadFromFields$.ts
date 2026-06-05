import {
   catchError,
   filter,
   isObservable,
   map,
   merge,
   of,
   share,
   tap
} from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexRun } from '../run/VertexRun'
import { compareVertexFields } from '../run/compareVertexFields'
import { VertexFieldState } from '../state/VertexFieldState'
import { pickFields } from '../state/pickFields'
import { toVertexLoadableState } from '../state/toVertexLoadableState'
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

      // Fields whose loader stream errored terminally. Such a branch is dead
      // and will never emit again, so on subsequent input changes we must keep
      // the field in `error` rather than resetting it to `loading` — otherwise
      // it would be stranded in a perpetual loading state.
      const deadFields: VertexFields = {}

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
            const picked = pickFields(fields, data.fields)
            const { status, errors } = toVertexLoadableState(picked)

            const reloadingFields: VertexFields = {}
            const changedLoadingFields: VertexChangedFields = {}
            loadableFieldNames.forEach(fieldName => {
               const deadField = deadFields[fieldName]
               if (deadField !== undefined) {
                  // Terminally errored: keep it in error, don't reload.
                  reloadingFields[fieldName] = deadField
               } else if (status === 'error') {
                  reloadingFields[fieldName] = {
                     status: 'error',
                     value: undefined,
                     errors
                  }
                  if (
                     data.initialRun ||
                     latestOutputFields[fieldName].status !== 'error'
                  ) {
                     changedLoadingFields[fieldName] = true
                  }
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
            // Flag the field changed only when it actually changed: a loader
            // re-emitting a reference-identical value is a no-op, so we must not
            // mark it changed or change-gated reads (pick) would re-fire and
            // downstream subgraphs would re-run for nothing. The caller computes
            // `changedFields` against the previous `latestOutputFields` BEFORE
            // overwriting it with the new field below.
            const emitOutput = (
               changedFields: VertexChangedFields
            ): VertexRunData => ({
               action: undefined,
               initialRun: false,
               reactions: [],
               fieldsReactions: [],
               sideEffects: [],
               fields: {
                  ...latestInputFields,
                  ...latestOutputFields
               },
               changedFields
            })
            // A loader error becomes an error field for THAT field only,
            // leaving the merged stream (and every other field) alive.
            // `catchError` emits one fallback value and then completes, so this
            // branch of the merge will never emit again — the field is dead.
            // We record it in `deadFields` so `loading$` keeps it in error on
            // later input changes instead of resetting it to `loading`. We
            // deliberately do NOT re-subscribe (that would loop on a
            // synchronously-erroring source).
            return result$.pipe(
               map(value => {
                  const field: VertexFieldState = {
                     status: 'loaded',
                     value,
                     errors: []
                  }
                  const changedFields = compareVertexFields(latestOutputFields, {
                     [fieldName]: field
                  })
                  latestOutputFields = {
                     ...latestOutputFields,
                     [fieldName]: field
                  }
                  return emitOutput(changedFields)
               }),
               catchError(error => {
                  const errorField = {
                     status: 'error' as const,
                     value: undefined,
                     errors: [error]
                  }
                  const changedFields = compareVertexFields(latestOutputFields, {
                     [fieldName]: errorField
                  })
                  // Branch is now dead; keep this field in error across later
                  // input changes instead of letting loading$ reset it.
                  deadFields[fieldName] = errorField
                  latestOutputFields = {
                     ...latestOutputFields,
                     [fieldName]: errorField
                  }
                  return of(emitOutput(changedFields))
               })
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

      // Order matters: `loading$` MUST precede `loaded$` in this merge. Both
      // react to the same shared input tick, and `merge` notifies its operands
      // in argument order, so `loading$` resets the shared `latestOutputFields`
      // to the per-field "loading" snapshot BEFORE `loaded$`'s `emitOutput()`
      // reads it. Reversing them would let `loaded$` read a stale snapshot, and
      // `loading$` would then clobber the just-loaded field back to "loading".
      return merge(loading$, loaded$, passingThrough$)
   }
