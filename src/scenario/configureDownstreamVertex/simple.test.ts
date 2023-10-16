import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureDownstreamVertex } from '../../config/configureDownstreamVertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const rootSlice = createSlice({
   name: 'root',
   initialState: {},
   reducers: {}
})
const rootVertexConfig = configureRootVertex({
   slice: rootSlice
})

const firstDownstreamSlice = createSlice({
   name: 'firstDownstream',
   initialState: { first: '' },
   reducers: {
      setFirst: (state, action) => {
         state.first = action.payload
      }
   }
})
const firstDownstreamConfig = rootVertexConfig.configureDownstreamVertex({
   slice: firstDownstreamSlice,
   dependencies: {
      firstDep: () => ({
         first: 'first'
      })
   }
})

const secondDownstreamSlice = createSlice({
   name: 'secondDownstream',
   initialState: { second: '' },
   reducers: {
      setSecond: (state, action) => {
         state.second = action.payload
      }
   }
})
const secondDownstreamConfig = rootVertexConfig.configureDownstreamVertex({
   slice: secondDownstreamSlice,
   dependencies: {
      secondDep: () => ({
         second: 'second'
      })
   }
})

const mergedDownstreamSlice = createSlice({
   name: 'mergedDownstream',
   initialState: { merged: '' },
   reducers: {}
})

const mergedDownstreamConfig = configureDownstreamVertex(
   {
      slice: mergedDownstreamSlice
   },
   builder =>
      builder
         .addUpstreamVertex(firstDownstreamConfig, {
            upstreamFields: ['first']
         })
         .addUpstreamVertex(secondDownstreamConfig, {
            upstreamFields: ['second']
         })
         .addDependencies({
            usernameTransformer:
               ({ firstDep, secondDep }) =>
               (username: string) =>
                  username.toLowerCase()
         })
).computeFromFields(['first', 'second'], ({ usernameTransformer }) => ({
   computedName: ({ first, second }) =>
      usernameTransformer(first + ' ' + second)
}))

describe('multiple upstream vertices', () => {
   let graph: Graph
   let vertex: Vertex<typeof mergedDownstreamConfig>
   beforeEach(() => {
      graph = createGraph({
         vertices: [
            rootVertexConfig,
            firstDownstreamConfig,
            secondDownstreamConfig,
            mergedDownstreamConfig
         ]
      })
      vertex = graph.getVertexInstance(mergedDownstreamConfig)
   })
   it('should merge upstream fields', () => {
      expect(vertex.currentState).to.deep.equal({
         first: '',
         second: '',
         merged: '',
         computedName: ' '
      })
   })
   describe('when first upstream field change', () => {
      beforeEach(() => {
         graph.dispatch(firstDownstreamSlice.actions.setFirst('FIRST'))
      })
      it('updates passed down field', () => {
         expect(vertex.currentState.first).to.equal('FIRST')
      })
      describe('when second upstream field change', () => {
         beforeEach(() => {
            graph.dispatch(secondDownstreamSlice.actions.setSecond('SECOND'))
         })
         it('updates passed down field', () => {
            expect(vertex.currentState.second).to.equal('SECOND')
         })
         it('computes from both upstream fields', () => {
            expect(vertex.currentState.computedName).to.equal('first second')
         })
      })
   })
})
