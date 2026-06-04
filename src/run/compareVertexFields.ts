import { VertexChangedFields, VertexFields } from './VertexFields'

// A field that stays in the same status with the same value can still carry a
// different error (e.g. a computeFromFields computer that throws a fresh error
// each run). Comparing only status + value misses that, so the field is left
// out of changedFields and change-gated reads (pick) never re-emit. Compare the
// errors too — by length then by reference — but skip when both are empty so
// the common loaded/loading case keeps the gating it relies on.
const errorsChanged = (previous: Error[], next: Error[]) => {
   if (previous.length === 0 && next.length === 0) return false
   if (previous.length !== next.length) return true
   for (let i = 0; i < previous.length; i++) {
      if (previous[i] !== next[i]) return true
   }
   return false
}

export const compareVertexFields = (
   previous: VertexFields | undefined,
   next: VertexFields
) => {
   const changedFields: VertexChangedFields = {}
   Object.keys(next).forEach(fieldName => {
      const prev = previous && previous[fieldName]
      if (
         !prev ||
         prev.status !== next[fieldName].status ||
         prev.value !== next[fieldName].value ||
         errorsChanged(prev.errors, next[fieldName].errors)
      ) {
         changedFields[fieldName] = true
      }
   })
   return changedFields
}
