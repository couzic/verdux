import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// When a computed field stays status:'error' but the error object changes from
// one run to the next, compareVertexFields must still mark the field changed — it
// compares `errors` as well as `status` and `value`. Otherwise pick([field]),
// gated on the picked field changing (createVertexInstance: filter on
// changedFields[field]), never re-emits, while currentLoadableState — pushed on
// every run because the raw `n` field changed — shows the fresh error, so two
// public reads of the same vertex would disagree.
//
// Full-graph public-API guard: fails on revert of the errors-comparison in
// compareVertexFields.ts.
describe('error→error transition is observable through pick', () => {
   const makeGraph = () => {
      const slice = createSlice({
         name: 'root',
         initialState: { n: 0 },
         reducers: {
            setN: (s, a: PayloadAction<number>) => {
               s.n = a.payload
            }
         }
      })
      const config = configureRootVertex({ slice }).computeFromFields(['n'], {
         // throws a DIFFERENT error object each run; status stays 'error'
         c: ({ n }) => {
            throw new Error('err-' + n)
         }
      })
      const graph = createGraph({ vertices: [config] })
      return { graph, slice, vertex: graph.getVertexInstance(config) }
   }

   it('pick re-emits the fresh error and agrees with currentLoadableState', () => {
      const { graph, slice, vertex } = makeGraph()
      const seen: string[][] = []
      vertex
         .pick(['c'])
         .subscribe((p: any) =>
            seen.push(p.errors.map((e: Error) => e.message))
         )
      graph.dispatch(slice.actions.setN(1))
      graph.dispatch(slice.actions.setN(2))
      // currentLoadableState reflects the latest error...
      expect(
         (vertex.currentLoadableState.fields as any).c.errors[0].message
      ).to.equal('err-2')
      // ...and pick must agree: c is marked changed when its error object
      // changes, so pick re-emits the latest error.
      expect(seen[seen.length - 1]).to.deep.equal(['err-2'])
   })
})
