import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { createGraph } from '../graph/createGraph'
import { configureRootVertex } from './configureRootVertex'
import { configureVertex } from './configureVertex'

// Shared fixture: `down` pulls ONLY `a` from `upstream` (and a second case
// pulls nothing). Built once at load; the graph runs fine — the point of these
// guards is the TYPE of `currentState`, plus the runtime parity assertion below.
const upstream = configureRootVertex({
   slice: createSlice({
      name: 'up',
      initialState: { a: 1, b: 'hello' },
      reducers: {}
   })
})
const pullsA = configureVertex(
   { slice: createSlice({ name: 'pullsA', initialState: {}, reducers: {} }) },
   _ => _.addUpstreamVertex(upstream, { fields: ['a'] }) // pulls ONLY `a`
)
const pullsNone = configureVertex(
   { slice: createSlice({ name: 'pullsNone', initialState: {}, reducers: {} }) },
   _ => _.addUpstreamVertex(upstream, {}) // omitted `fields` → pulls NONE
)

// Compile-time guard — NEVER executed. ts-node type-checks this on load;
// each unused `@ts-expect-error` fails the build (TS2578) the moment an unpulled
// field stops being a type error, i.e. if the type goes back to lying.
function _pulledFieldsTypeGuard() {
   const a = createGraph({ vertices: [upstream, pullsA] }).getVertexInstance(
      pullsA
   ).currentState
   a.a // pulled → present in the type
   // @ts-expect-error `b` was not pulled into this vertex
   a.b

   const none = createGraph({
      vertices: [upstream, pullsNone]
   }).getVertexInstance(pullsNone).currentState
   // @ts-expect-error `a` was not pulled into this vertex
   none.a
   // @ts-expect-error `b` was not pulled into this vertex
   none.b
}

// Runtime guard — an unpulled field must be genuinely
// absent at runtime, so the type above is honest rather than just stricter.
describe('multi-upstream field pulling (runtime parity)', () => {
   it('exposes only the fields listed in `fields`', () => {
      const vertex = createGraph({
         vertices: [upstream, pullsA]
      }).getVertexInstance(pullsA)
      expect(vertex.currentState.a).to.equal(1)
      expect(vertex.currentState).not.to.have.property('b')
   })

   it('exposes no upstream fields when `fields` is omitted', () => {
      const vertex = createGraph({
         vertices: [upstream, pullsNone]
      }).getVertexInstance(pullsNone)
      expect(vertex.currentState).not.to.have.property('a')
      expect(vertex.currentState).not.to.have.property('b')
   })
})
