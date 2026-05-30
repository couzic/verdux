import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { map } from 'rxjs'
import { configureRootVertex } from 'verdux'

// Demonstrates the four "react to something" operations:
//   reaction        — map a tracked action -> a new action (1:1)
//   reaction$       — map a stream of a tracked action -> a stream of actions
//   fieldsReaction  — when picked fields change, dispatch an action (or null)
//   sideEffect      — run an effect on a tracked action; dispatch nothing
//
// reaction / reaction$ / fieldsReaction re-dispatch their result back through
// the store; sideEffect is the escape hatch for effects that must NOT feed a
// new action (logging, analytics, imperative navigation).

const slice = createSlice({
   name: 'reactions',
   initialState: { count: 0, query: '', lastEcho: '', sizeBucket: '' },
   reducers: {
      incremented: state => {
         state.count += 1
      },
      queryChanged: (state, action: PayloadAction<string>) => {
         state.query = action.payload
      },
      echo: (state, action: PayloadAction<string>) => {
         state.lastEcho = action.payload
      },
      sizeBucketChanged: (state, action: PayloadAction<string>) => {
         state.sizeBucket = action.payload
      }
   }
})

export const reactionActions = slice.actions
const { incremented, queryChanged, echo, sizeBucketChanged } = slice.actions

// A flag the sideEffect flips, exported so a test can assert on it.
export const effectLog: string[] = []

export const reactionsVertexConfig = configureRootVertex({ slice })
   // reaction: one tracked action in, one action out
   .reaction(incremented, () => echo('incremented'))
   // reaction$: operate on the stream of the tracked action (debounce, etc.)
   .reaction$(queryChanged, action$ =>
      action$.pipe(map(({ payload }) => echo(payload)))
   )
   // fieldsReaction: fires when the picked fields change; return null to skip
   .fieldsReaction(['count'], ({ count }) =>
      count >= 3 ? sizeBucketChanged('big') : sizeBucketChanged('small')
   )
   // sideEffect: run an effect, dispatch nothing
   .sideEffect(incremented, () => {
      effectLog.push('increment effect')
   })
