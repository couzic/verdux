import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { map, of } from 'rxjs'
import { configureRootVertex } from 'verdux'

// Demonstrates the five "produce a field" operations on one vertex:
//   computeFromFields   — sync derived field
//   computeFromFields$  — derived field via an rxjs operator on the stream
//   load                — loadable field from a standalone observable
//   loadFromFields      — loadable field from picked field values
//   loadFromFields$     — loadable field via an operator on the picked stream

const slice = createSlice({
   name: 'compute',
   initialState: { count: 0, query: '' },
   reducers: {
      incremented: state => {
         state.count += 1
      },
      queryChanged: (state, action: PayloadAction<string>) => {
         state.query = action.payload
      }
   }
})

export const computeActions = slice.actions

export const computeAndLoadVertexConfig = configureRootVertex({ slice })
   // sync: pure function of the picked field values
   .computeFromFields(['count'], {
      doubled: ({ count }) => count * 2
   })
   // stream: receives an Observable of the picked values, returns an Observable
   .computeFromFields$(['count'], {
      tripled: count$ => count$.pipe(map(({ count }) => count * 3))
   })
   // load: a loadable field fed by a standalone observable (no field inputs)
   .load({
      greeting: of('hello')
   })
   // loadFromFields: loader receives picked values, returns an observable
   .loadFromFields(['count'], {
      countLabel: ({ count }) => of(`count=${count}`)
   })
   // loadFromFields$: loader is an operator over the picked-values stream —
   // the place for debounce / switchMap / distinctUntilChanged
   .loadFromFields$(['query'], {
      upperQuery: query$ => query$.pipe(map(({ query }) => query.toUpperCase()))
   })
