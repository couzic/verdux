import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Graph } from '../../Graph'
import { Vertex } from '../../Vertex'
import { configureDownstreamVertex } from '../../config/configureDownstreamVertex'
import { configureRootVertex } from '../../config/configureRootVertex'
import { createGraph } from '../../createGraph'

const rootSlice = createSlice({
   name: 'root',
   initialState: { firstName: '', lastName: '' },
   reducers: {
      setName: (state, action) => {
         state.firstName = action.payload.firstName
         state.lastName = action.payload.lastName
      }
   }
})
const rootVertexConfig = configureRootVertex({
   slice: rootSlice
})

const firstDownstreamSlice = createSlice({
   name: 'firstName',
   initialState: {},
   reducers: {}
})
const firstDownstreamConfig = rootVertexConfig
   .configureDownstreamVertex({
      slice: firstDownstreamSlice,
      upstreamFields: ['firstName']
   })
   .computeFromFields(['firstName'], {
      upperCaseFirstName: ({ firstName }) => firstName.toUpperCase()
   })

const secondDownstreamSlice = createSlice({
   name: 'lastName',
   initialState: {},
   reducers: {}
})
const secondDownstreamConfig = rootVertexConfig
   .configureDownstreamVertex({
      slice: secondDownstreamSlice,
      upstreamFields: ['lastName']
   })
   .computeFromFields(['lastName'], {
      upperCaseLastName: ({ lastName }) => lastName.toUpperCase()
   })

const mergedDownstreamSlice = createSlice({
   name: 'mergedDownstream',
   initialState: {},
   reducers: {}
})

const mergedDownstreamConfig = configureDownstreamVertex(
   {
      slice: mergedDownstreamSlice
   },
   builder =>
      builder
         .addUpstreamVertex(firstDownstreamConfig, {
            upstreamFields: ['upperCaseFirstName']
         })
         .addUpstreamVertex(secondDownstreamConfig, {
            upstreamFields: ['upperCaseLastName']
         })
).computeFromFields(['upperCaseFirstName', 'upperCaseLastName'], {
   fullName: ({ upperCaseFirstName, upperCaseLastName }) =>
      upperCaseFirstName + ' ' + upperCaseLastName
})

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
   describe('when full name changes', () => {
      beforeEach(() => {
         vertex.state$.subscribe(state => {
            if (state.fullName !== ' ' && state.fullName !== 'JOHN SNOW') {
               throw new Error('Unexpected state: ' + state)
            }
         })
         graph.dispatch(
            rootSlice.actions.setName({ firstName: 'John', lastName: 'Snow' })
         )
      })
      it('updates full name', () => {
         expect(vertex.currentState.fullName).to.equal('JOHN SNOW')
      })
   })
   describe('when first name only changes', () => {
      beforeEach(() => {
         expect(vertex.currentState.fullName).to.equal(' ')
         graph.dispatch(
            rootSlice.actions.setName({ firstName: 'John', lastName: '' })
         )
      })
      it('updates full name', () => {
         expect(vertex.currentState.fullName).to.equal('JOHN ')
      })
   })
})
