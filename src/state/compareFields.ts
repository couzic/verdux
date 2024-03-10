import { VertexFieldState } from './VertexFieldState'

export const compareFields = (
   previous: Record<string, VertexFieldState>,
   next: Record<string, VertexFieldState>
) => {
   let previousEqualsNext = true
   Object.keys(previous).forEach(key => {
      if (previous[key] === next[key]) {
         // same reference, no need to check further
      } else if (previous[key].status !== next[key].status) {
         previousEqualsNext = false
      } else if (previous[key].value !== next[key].value) {
         previousEqualsNext = false
      } else if (
         previous[key].errors.length > 0 ||
         next[key].errors.length > 0
      ) {
         previous[key].errors.forEach((error, index) => {
            if (error !== next[key].errors[index]) {
               previousEqualsNext = false
            }
         })
      }
   })
   return previousEqualsNext
}
