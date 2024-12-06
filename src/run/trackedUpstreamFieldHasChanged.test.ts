import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { configureRootVertex } from '../config/configureRootVertex'
import { GraphRunData } from './RunData'
import { trackedUpstreamFieldHasChanged } from './trackedUpstreamFieldHasChanged'

const sut = trackedUpstreamFieldHasChanged

describe(sut.name, () => {
   it('handles case where no tracked field has changed', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { trackedField: '', untrackedField: '' },
            reducers: {}
         })
      }) as unknown as VertexConfigImpl
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstreamVertexName',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['trackedField']
         }
      ) as VertexConfigImpl
      const data: GraphRunData = {
         action: undefined,
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: { trackedField: '', untrackedField: '' },
               downstream: {
                  downstreamVertexName: { vertex: {}, downstream: {} }
               }
            },
            [downstreamVertexConfig.id]: { vertex: {}, downstream: {} }
         },
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               trackedField: {
                  status: 'loaded',
                  value: '',
                  errors: []
               },
               untrackedField: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: { untrackedField: true }
         },
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      expect(sut(downstreamVertexConfig, data)).to.be.false
   })

   it('detects change in tracked upstream field', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { trackedField: '' },
            reducers: {}
         })
      }) as unknown as VertexConfigImpl
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstreamVertexName',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['trackedField']
         }
      ) as unknown as VertexConfigImpl
      const data: GraphRunData = {
         action: undefined,
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: { trackedField: '' },
               downstream: {
                  downstreamVertexName: { vertex: {}, downstream: {} }
               }
            },
            [downstreamVertexConfig.id]: { vertex: {}, downstream: {} }
         },
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               trackedField: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: { trackedField: true }
         },
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      expect(sut(downstreamVertexConfig, data)).to.be.true
   })

   it('supports missing upstream vertex changed fields', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { trackedField: '' },
            reducers: {}
         })
      }) as unknown as VertexConfigImpl
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstreamVertexName',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['trackedField']
         }
      ) as VertexConfigImpl
      const data: GraphRunData = {
         action: undefined,
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: {},
               downstream: {
                  downstreamVertexName: { vertex: {}, downstream: {} }
               }
            },
            [downstreamVertexConfig.id]: { vertex: {}, downstream: {} }
         },
         fieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         changedFieldsByVertexId: {},
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: true
      }
      expect(sut(downstreamVertexConfig, data)).to.be.false
   })
})
