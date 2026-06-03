import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import * as sinon from 'sinon'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from './createGraph'

// C1 — a single unguarded throw must not permanently kill the whole graph.
// Each repro drives a throw through a full graph and asserts, on the PUBLIC
// surface, both that the graph is still alive (a LATER dispatch is processed)
// and that it published the right thing. These are fail-on-revert guards:
// reverting fieldsReaction's try/catch (C1b) or compareVertexFields' per-field
// existence guard (C1c) makes the corresponding block go red.
describe('graph error resilience', () => {
   describe('C1b — a throwing fieldsReaction mapper does not kill the graph', () => {
      // the mapper throws on purpose in these tests; stub console.error so the
      // (intentional) diagnostic doesn't pollute the suite output, and so the
      // logging test below can assert on it.
      let errorStub: sinon.SinonStub
      beforeEach(() => {
         errorStub = sinon.stub(console, 'error')
      })
      afterEach(() => {
         errorStub.restore()
      })

      const makeGraph = () => {
         const slice = createSlice({
            name: 'root',
            initialState: { name: '', other: '' },
            reducers: {
               setName: (s, a: PayloadAction<string>) => {
                  s.name = a.payload
               },
               setOther: (s, a: PayloadAction<string>) => {
                  s.other = a.payload
               }
            }
         })
         const config = configureRootVertex({ slice }).fieldsReaction(
            ['name'],
            ({ name }) => {
               if (name === 'boom') throw new Error('mapper exploded')
               return slice.actions.setOther('reacted')
            }
         )
         const graph = createGraph({ vertices: [config] })
         return { graph, slice, vertex: graph.getVertexInstance(config) }
      }

      it('still processes a later, unrelated dispatch', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.setName('boom')) // triggers the throwing mapper
         graph.dispatch(slice.actions.setOther('hello')) // later, unrelated dispatch
         // CURRENT (pre-fix): '' — graph is dead, this dispatch was dropped.
         expect(vertex.currentState.other).to.equal('hello')
      })

      it('recovers the fieldsReaction for a later valid field change', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.setName('boom')) // throws, is swallowed
         graph.dispatch(slice.actions.setName('John')) // valid → mapper re-dispatches setOther
         expect(vertex.currentState.name).to.equal('John')
         expect(vertex.currentState.other).to.equal('reacted')
      })

      it('logs the swallowed error (does not fail silently)', () => {
         const { graph, slice } = makeGraph()
         graph.dispatch(slice.actions.setName('boom')) // throws inside the mapper
         // CURRENT (pre-fix): not called — the error vanishes with no trace.
         expect(
            errorStub.calledWithMatch('fieldsReaction on fields [name]')
         ).to.equal(true)
      })
   })

   describe('C1c — a newly added top-level slice key does not kill the graph', () => {
      const makeGraph = () => {
         const slice = createSlice({
            name: 'root',
            initialState: { count: 1 } as Record<string, number>,
            reducers: {
               addKey: (s, a: PayloadAction<string>) => {
                  s[a.payload] = 0 // adds a genuinely new top-level field
               },
               bump: s => {
                  s.count += 1
               }
            }
         })
         const config = configureRootVertex({ slice })
         const graph = createGraph({ vertices: [config] })
         return { graph, slice, vertex: graph.getVertexInstance(config) }
      }

      it('still processes a later, unrelated dispatch', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.addKey('b')) // previous fields lack 'b' → throws pre-fix
         graph.dispatch(slice.actions.bump())
         // CURRENT (pre-fix): 1 — graph is dead. EXPECTED: 2.
         expect(vertex.currentState.count).to.equal(2)
      })

      it('reflects the newly added field in published state', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.addKey('b'))
         // CURRENT (pre-fix): throws on the new key → nothing published.
         expect(vertex.currentState).to.deep.equal({ count: 1, b: 0 })
      })
   })

   // M1 — a throwing reaction mapper / sideEffect callback must be logged (not
   // silently swallowed, not left uncaught) while the graph stays alive.
   describe('M1 — a throwing reaction mapper is logged, not swallowed silently', () => {
      let errorStub: sinon.SinonStub
      beforeEach(() => {
         errorStub = sinon.stub(console, 'error')
      })
      afterEach(() => {
         errorStub.restore()
      })

      const makeGraph = () => {
         const slice = createSlice({
            name: 'root',
            initialState: { n: 0 },
            reducers: {
               trig: () => {},
               set: (s, a: PayloadAction<number>) => {
                  s.n = a.payload
               }
            }
         })
         const config = configureRootVertex({ slice }).reaction(
            slice.actions.trig,
            () => {
               throw new Error('reaction boom')
            }
         )
         const graph = createGraph({ vertices: [config] })
         return { graph, slice, vertex: graph.getVertexInstance(config) }
      }

      it('logs the error', () => {
         const { graph, slice } = makeGraph()
         graph.dispatch(slice.actions.trig())
         expect(
            errorStub.calledWithMatch('reaction on "root/trig" threw')
         ).to.equal(true)
      })

      it('keeps the graph alive', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.trig()) // throws inside the mapper, logged
         graph.dispatch(slice.actions.set(5))
         expect(vertex.currentState.n).to.equal(5)
      })
   })

   describe('M1 — a throwing sideEffect callback is logged, not left uncaught', () => {
      let errorStub: sinon.SinonStub
      beforeEach(() => {
         errorStub = sinon.stub(console, 'error')
      })
      afterEach(() => {
         errorStub.restore()
      })

      const makeGraph = () => {
         const slice = createSlice({
            name: 'root',
            initialState: { n: 0 },
            reducers: {
               trig: () => {},
               set: (s, a: PayloadAction<number>) => {
                  s.n = a.payload
               }
            }
         })
         const config = configureRootVertex({ slice }).sideEffect(
            slice.actions.trig,
            () => {
               throw new Error('sideEffect boom')
            }
         )
         const graph = createGraph({ vertices: [config] })
         return { graph, slice, vertex: graph.getVertexInstance(config) }
      }

      it('logs the error', () => {
         const { graph, slice } = makeGraph()
         graph.dispatch(slice.actions.trig())
         expect(
            errorStub.calledWithMatch('sideEffect on "root/trig" threw')
         ).to.equal(true)
      })

      it('keeps the graph alive', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.trig()) // callback throws, logged
         graph.dispatch(slice.actions.set(7))
         expect(vertex.currentState.n).to.equal(7)
      })
   })
})
