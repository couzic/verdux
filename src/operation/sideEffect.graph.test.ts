import { createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'

// H1 — a sideEffect on a DOWNSTREAM vertex must fire even when the triggering
// action doesn't mutate that vertex's slice. The subgraph gate only runs a
// downstream vertex when its own slice changed, a tracked upstream field
// changed, or the action is tracked; sideEffect used not to track its action
// (`// TODO Track action ???`), so it was gated out and never fired — which is
// exactly its documented purpose (effects that must not feed a reducer).
//
// This is a full-graph public-API guard: it drives `graph.dispatch` and reads
// the observable side effect. It fails on revert (drop the trackedActions.push
// in VertexOperationsBuilder.sideEffect and the first test goes red — `fired`
// stays 0). The two controls isolate the cause.
describe('sideEffect on a full graph (H1)', () => {
   // a plain action that the downstream slice's reducer ignores
   const trigger = createAction('trigger')

   const makeRoot = () =>
      configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      })

   it('fires for a downstream vertex whose slice the action does not touch', () => {
      const root = makeRoot()
      let fired = 0
      const down = root
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'down',
               initialState: { x: 0 },
               reducers: {}
            })
         })
         .sideEffect(trigger, () => {
            fired += 1
         })
      const graph = createGraph({ vertices: [root, down] })
      graph.dispatch(trigger())
      expect(fired).to.equal(1) // PRE-FIX: 0 (gated out)
   })

   // Control A: the same sideEffect on the ROOT vertex always fired (no gate),
   // which is what masked the bug in the README example.
   it('control: a sideEffect on the root vertex fires', () => {
      let fired = 0
      const root = makeRoot().sideEffect(trigger, () => {
         fired += 1
      })
      const graph = createGraph({ vertices: [root] })
      graph.dispatch(trigger())
      expect(fired).to.equal(1)
   })

   // Control B: a co-located reaction on the same downstream vertex tracks the
   // action, which (pre-fix) made the sideEffect fire too — pinpointing action
   // tracking as the mechanism.
   it('control: a co-located reaction tracking the action makes the sideEffect fire', () => {
      const noop = createAction('noop')
      const root = makeRoot()
      let fired = 0
      const down = root
         .configureDownstreamVertex({
            slice: createSlice({
               name: 'down',
               initialState: { x: 0 },
               reducers: {}
            })
         })
         .reaction(trigger, () => noop())
         .sideEffect(trigger, () => {
            fired += 1
         })
      const graph = createGraph({ vertices: [root, down] })
      graph.dispatch(trigger())
      expect(fired).to.equal(1)
   })
})
