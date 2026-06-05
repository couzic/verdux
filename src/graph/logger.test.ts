import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import * as sinon from 'sinon'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from './createGraph'

// The injected-logger path is proven by each operation's own error test
// (graphErrorResilience, reaction$.error, fieldsReaction.error, loaderError, …),
// which pass a capturing `logger` to createGraph and assert on it. This file owns
// the ONE remaining responsibility: the non-breaking default. With no `logger`,
// diagnostics must still reach `console.error` exactly as before — this is the
// only place a console spy is warranted.
describe('createGraph diagnostics fall back to console.error when no logger is given', () => {
   let errorStub: sinon.SinonStub
   beforeEach(() => {
      errorStub = sinon.stub(console, 'error')
   })
   afterEach(() => {
      errorStub.restore()
   })

   it('routes a diagnostic to console.error', () => {
      const slice = createSlice({
         name: 'root',
         initialState: { n: 0 },
         reducers: { trig: () => {} }
      })
      const config = configureRootVertex({ slice }).reaction(
         slice.actions.trig,
         () => {
            throw new Error('reaction boom')
         }
      )
      const graph = createGraph({ vertices: [config] }) // no logger
      graph.dispatch(slice.actions.trig())
      expect(errorStub.calledWithMatch('reaction on "root/trig" threw')).to.equal(
         true
      )
   })
})
