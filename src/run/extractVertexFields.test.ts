import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { configureRootVertex } from '../config/configureRootVertex'
import { computeGraphCoreInfo } from '../graph/computeGraphCoreInfo'
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
      }) as unknown as VertexConfigImpl
      const coreInfo = computeGraphCoreInfo([rootVertexConfig])
      const reduxState = {
         vertex: { name: '' },
         downstream: {}
      }
      const runData: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         fieldsByVertexId: {},
         changedFieldsByVertexId: {},
         initialRun: true
      }
      const fields = extractVertexFields(
         rootVertexConfig,
         coreInfo,
         () => reduxState
      )(runData)
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
      ) as unknown as VertexConfigImpl
      const coreInfo = computeGraphCoreInfo([
         rootVertexConfig,
         downstreamVertexConfig
      ])
      const reduxState = {
         vertex: { name: '' },
         downstream: {
            downstreamVertexName: {
               vertex: {},
               downstream: {}
            }
         }
      }
      const runData: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: { status: 'loaded', value: '', errors: [] }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: { name: true }
         },
         initialRun: true
      }
      const fields = extractVertexFields(
         downstreamVertexConfig,
         coreInfo,
         () => reduxState
      )(runData)
      expect(fields).to.deep.equal({
         name: {
            status: 'loaded',
            value: '',
            errors: []
         }
      })
   })
})
