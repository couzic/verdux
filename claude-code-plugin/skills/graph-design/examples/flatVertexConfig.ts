import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import {
   debounceTime,
   distinctUntilChanged,
   map,
   of,
   pipe,
   switchMap
} from 'rxjs'
import { rootVertexConfig } from './rootVertexConfig'

// A flat feature vertex: hangs directly off the root, no upstreamFields.
// Demonstrates `.load`, a reducer-driven field, and `.loadFromFields$`.

interface ProductSearchState {
   query: string
}

const slice = createSlice({
   name: 'productSearch',
   initialState: { query: '' } as ProductSearchState,
   reducers: {
      queryChanged: (state, action: PayloadAction<string>) => {
         state.query = action.payload
      }
   }
})

export const productSearchActions = slice.actions

export const productSearchVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice })
   .withDependencies(({ apiClient }, vertex) =>
      vertex.loadFromFields$(['query'], {
         results: pipe(
            map(_ => _.query.trim().toLowerCase()),
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(q => (q.length === 0 ? of([]) : apiClient.search(q)))
         )
      })
   )
