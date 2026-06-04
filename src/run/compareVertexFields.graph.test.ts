import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// H3 — when a computed field stays status:'error' but the error object changes
// from one run to the next, compareVertexFields (which compares only `status`
// and `value`) fails to mark the field changed. pick([field]) is gated on the
// picked field changing (createVertexInstance: filter on changedFields[field]),
// so it never re-emits — while currentLoadableState, pushed on every run because
// the raw `n` field changed, shows the fresh error. Two public reads of the same
// vertex disagree.
//
// Full-graph public-API guard. Fails on the current tree; fails on revert of the
// errors-comparison fix in compareVertexFields.ts.
describe('error→error transition is observable through pick (H3)', () => {
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
      // ...and pick must agree. PRE-FIX: stale (c never marked changed, so
      // pick re-emitted nothing after the initial err-0).
      expect(seen[seen.length - 1]).to.deep.equal(['err-2'])
   })
})
