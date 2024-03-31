import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { configureRootVertex } from '../config/configureRootVertex'
import { GraphRunData } from './RunData'
import { extractVertexFields } from './extractVertexFields'

const sut = extractVertexFields

describe(sut.name, () => {
   it('extracts field from redux state', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { name: '' },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })
      }) as VertexConfigImpl
      const runData: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: { name: '' },
               downstream: {}
            }
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {}
      }
      const fields = extractVertexFields(rootVertexConfig)(runData)
      expect(fields).to.deep.equal({
         name: {
            status: 'loaded',
            value: '',
            errors: []
         }
      })
   })
   it('extracts field from upstream vertex', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { name: '' },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })
      })
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstreamVertexName',
               initialState: {},
               reducers: {}
            }),
            upstreamFields: ['name']
         }
      ) as VertexConfigImpl
      const runData: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: { name: '' },
               downstream: {
                  downstreamVertexName: {
                     vertex: {},
                     downstream: {}
                  }
               }
            },
            [downstreamVertexConfig.id]: {
               vertex: {},
               downstream: {}
            }
         },
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: { status: 'loaded', value: '', errors: [] }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: { name: true }
         }
      }
      const fields = extractVertexFields(downstreamVertexConfig)(runData)
      expect(fields).to.deep.equal({
         name: {
            status: 'loaded',
            value: '',
            errors: []
         }
      })
   })
})
