interface Item<T> {
   next: Item<T> | undefined
   value: T
}

export interface FIFO<T> {
   push: (item: T) => void
   pop: () => T | undefined
   hasNext: () => boolean
}

export const createFIFO = <T>(): FIFO<T> => {
   let first: Item<T> | undefined
   let last: Item<T> | undefined

   const push = (value: T) => {
      const item: Item<T> = { value, next: undefined }
      if (first === undefined) {
         first = item
      } else {
         last!.next = item
      }
      last = item
   }

   const pop = () => {
      if (first === undefined) {
         return undefined
      }
      const value = first.value
      first = first.next
      if (first === undefined) {
         last = undefined
      }
      return value
   }

   const hasNext = () => first !== undefined

   return { push, pop, hasNext }
}
