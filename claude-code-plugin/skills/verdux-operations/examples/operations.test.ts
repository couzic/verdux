import { expect } from 'chai'
import { createGraph } from 'verdux'
import {
   computeActions,
   computeAndLoadVertexConfig
} from './computeAndLoadOperations'
import {
   effectLog,
   reactionActions,
   reactionsVertexConfig
} from './reactionOperations'

// Runnable verification for the operations reference. Builds a real graph,
// dispatches actions, and asserts on the resulting fields.

describe('compute & load operations', () => {
   it('produces derived and loaded fields, and updates them on dispatch', () => {
      const graph = createGraph({ vertices: [computeAndLoadVertexConfig] })
      const vertex = graph.getVertexInstance(computeAndLoadVertexConfig)

      expect(vertex.currentState.doubled).to.equal(0)
      expect(vertex.currentState.tripled).to.equal(0)
      expect(vertex.currentState.greeting).to.equal('hello')
      expect(vertex.currentState.countLabel).to.equal('count=0')
      expect(vertex.currentState.upperQuery).to.equal('')

      graph.dispatch(computeActions.incremented())
      expect(vertex.currentState.doubled).to.equal(2)
      expect(vertex.currentState.tripled).to.equal(3)
      expect(vertex.currentState.countLabel).to.equal('count=1')

      graph.dispatch(computeActions.queryChanged('abc'))
      expect(vertex.currentState.upperQuery).to.equal('ABC')
   })
})

describe('reaction & side-effect operations', () => {
   beforeEach(() => {
      effectLog.length = 0
   })

   it('reaction maps an action to another action', () => {
      const graph = createGraph({ vertices: [reactionsVertexConfig] })
      const vertex = graph.getVertexInstance(reactionsVertexConfig)
      graph.dispatch(reactionActions.incremented())
      expect(vertex.currentState.lastEcho).to.equal('incremented')
   })

   it('reaction$ maps a stream of an action to a stream of actions', () => {
      const graph = createGraph({ vertices: [reactionsVertexConfig] })
      const vertex = graph.getVertexInstance(reactionsVertexConfig)
      graph.dispatch(reactionActions.queryChanged('hey'))
      expect(vertex.currentState.lastEcho).to.equal('hey')
   })

   it('fieldsReaction dispatches when a picked field changes', () => {
      const graph = createGraph({ vertices: [reactionsVertexConfig] })
      const vertex = graph.getVertexInstance(reactionsVertexConfig)
      graph.dispatch(reactionActions.incremented())
      expect(vertex.currentState.sizeBucket).to.equal('small')
      graph.dispatch(reactionActions.incremented())
      graph.dispatch(reactionActions.incremented())
      expect(vertex.currentState.count).to.equal(3)
      expect(vertex.currentState.sizeBucket).to.equal('big')
   })

   it('sideEffect runs without dispatching', () => {
      const graph = createGraph({ vertices: [reactionsVertexConfig] })
      graph.dispatch(reactionActions.incremented())
      expect(effectLog).to.deep.equal(['increment effect'])
   })
})
