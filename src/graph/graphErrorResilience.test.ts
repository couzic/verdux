import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { makeLogger } from '../test/makeLogger'
import { createGraph } from './createGraph'

// A single unguarded throw from user-supplied code must not permanently kill the
// whole graph. Each block drives a throw through a full graph and asserts, on the
// PUBLIC surface, both that the graph is still alive (a LATER dispatch is
// processed) and that it published the right thing. These are fail-on-revert
// guards: reverting the fieldsReaction try/catch, or compareVertexFields'
// per-field existence guard, makes the corresponding block go red.
describe('graph error resilience', () => {
   describe('a throwing fieldsReaction mapper does not kill the graph', () => {
      const makeGraph = () => {
         const { logger, logged } = makeLogger()
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
         const graph = createGraph({ vertices: [config], logger })
         return { graph, slice, vertex: graph.getVertexInstance(config), logged }
      }

      it('still processes a later, unrelated dispatch', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.setName('boom')) // triggers the throwing mapper
         graph.dispatch(slice.actions.setOther('hello')) // later, unrelated dispatch
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
         const { graph, slice, logged } = makeGraph()
         graph.dispatch(slice.actions.setName('boom')) // throws inside the mapper
         expect(logged('fieldsReaction on fields [name]')).to.equal(true)
      })
   })

   describe('a newly added top-level slice key does not kill the graph', () => {
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
         graph.dispatch(slice.actions.addKey('b')) // adds a key absent from prior fields
         graph.dispatch(slice.actions.bump())
         expect(vertex.currentState.count).to.equal(2)
      })

      it('reflects the newly added field in published state', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.addKey('b'))
         expect(vertex.currentState).to.deep.equal({ count: 1, b: 0 })
      })
   })

   // A throwing reaction mapper / sideEffect callback must be logged (not
   // silently swallowed, not left uncaught) while the graph stays alive.
   describe('a throwing reaction mapper is logged, not swallowed silently', () => {
      const makeGraph = () => {
         const { logger, logged } = makeLogger()
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
         const graph = createGraph({ vertices: [config], logger })
         return { graph, slice, vertex: graph.getVertexInstance(config), logged }
      }

      it('logs the error', () => {
         const { graph, slice, logged } = makeGraph()
         graph.dispatch(slice.actions.trig())
         expect(logged('reaction on "root/trig" threw')).to.equal(true)
      })

      it('keeps the graph alive', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.trig()) // throws inside the mapper, logged
         graph.dispatch(slice.actions.set(5))
         expect(vertex.currentState.n).to.equal(5)
      })
   })

   // computeFromFields$ is a FIELD-PRODUCING operation, so when its inner
   // observable errors it must CONTAIN the error itself (per the operation
   // contract): degrade the affected field to `error` status, keep the graph
   // alive, and NOT log (the error-status field IS the report). Nothing escapes
   // to the graph-level fail-fast handler, so no diagnostic is logged and a later
   // dispatch still flows. (That handler still exists for genuinely-escaped
   // errors; this contained case never reaches it.)
   describe('a computeFromFields$ inner-stream error is contained, not escaped', () => {
      const makeGraph = () => {
         const { logger, logged } = makeLogger()
         const slice = createSlice({
            name: 'root',
            initialState: { n: 0, other: '' },
            reducers: {
               setN: (s, a: PayloadAction<number>) => {
                  s.n = a.payload
               },
               setOther: (s, a: PayloadAction<string>) => {
                  s.other = a.payload
               }
            }
         })
         const config = configureRootVertex({ slice }).computeFromFields$(['n'], {
            doubled: (fields$: any) =>
               fields$.pipe(
                  map(({ n }: any) => {
                     if (n === 99) throw new Error('compute$ exploded')
                     return n * 2
                  })
               )
         })
         const graph = createGraph({ vertices: [config], logger })
         return { graph, slice, vertex: graph.getVertexInstance(config), logged }
      }

      it('does NOT log a graph-level escaped-error diagnostic (the field carries the error)', () => {
         const { graph, slice, logged } = makeGraph()
         graph.dispatch(slice.actions.setN(99)) // inner observable errors
         expect(logged('escaped all operation-level handling')).to.equal(false)
      })

      it('stays alive: a later, unrelated dispatch IS reflected', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.setN(99)) // contained → graph stays alive
         graph.dispatch(slice.actions.setOther('alive')) // still processed
         expect((vertex.currentState as any).other).to.equal('alive')
      })
   })

   describe('a throwing sideEffect callback is logged, not left uncaught', () => {
      const makeGraph = () => {
         const { logger, logged } = makeLogger()
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
         const graph = createGraph({ vertices: [config], logger })
         return { graph, slice, vertex: graph.getVertexInstance(config), logged }
      }

      it('logs the error', () => {
         const { graph, slice, logged } = makeGraph()
         graph.dispatch(slice.actions.trig())
         expect(logged('sideEffect on "root/trig" threw')).to.equal(true)
      })

      it('keeps the graph alive', () => {
         const { graph, slice, vertex } = makeGraph()
         graph.dispatch(slice.actions.trig()) // callback throws, logged
         graph.dispatch(slice.actions.set(7))
         expect(vertex.currentState.n).to.equal(7)
      })
   })
})
