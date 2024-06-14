import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { configureRootVertex } from '../config/configureRootVertex'
import { configureVertex } from '../config/configureVertex'
import { computeGraphCoreInfo } from './computeGraphCoreInfo'
import { createGraph } from './createGraph'

const rootVertexConfig = configureRootVertex({
   slice: createSlice({
      name: 'root',
      initialState: {},
      reducers: {}
   })
})

const namedSlice = (name: string) =>
   createSlice({
      name,
      initialState: {},
      reducers: {}
   })

describe(computeGraphCoreInfo.name + ' (duplicate vertex ids)', () => {
   it('throws error on duplicate root id', () => {
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: namedSlice('root')
         }
      )
      expect(() =>
         createGraph({
            vertices: [rootVertexConfig, downstreamVertexConfig]
         })
      ).to.throw('Duplicate vertex id: root')
   })
   it('throws error on duplicate downstream id', () => {
      const firstDownstreamVertexConfig =
         rootVertexConfig.configureDownstreamVertex({
            slice: namedSlice('downstream')
         })
      const secondDownstreamVertexConfig =
         rootVertexConfig.configureDownstreamVertex({
            slice: namedSlice('downstream')
         })
      expect(() =>
         createGraph({
            vertices: [
               rootVertexConfig,
               firstDownstreamVertexConfig,
               secondDownstreamVertexConfig
            ]
         })
      ).to.throw('Duplicate vertex id: downstream')
   })
   it('throws error on duplicate downstream of common ancestor', () => {
      const firstDownstreamVertexConfig =
         rootVertexConfig.configureDownstreamVertex({
            slice: namedSlice('downstream1')
         })
      const secondDownstreamVertexConfig =
         rootVertexConfig.configureDownstreamVertex({
            slice: namedSlice('downstream2')
         })
      const firstDuplicate = configureVertex(
         {
            slice: namedSlice('duplicate')
         },
         builder =>
            builder
               .addUpstreamVertex(firstDownstreamVertexConfig, {})
               .addUpstreamVertex(secondDownstreamVertexConfig, {})
      )
      const secondDuplicate = rootVertexConfig.configureDownstreamVertex({
         slice: namedSlice('duplicate')
      })
      expect(() =>
         createGraph({
            vertices: [
               rootVertexConfig,
               firstDownstreamVertexConfig,
               secondDownstreamVertexConfig,
               firstDuplicate,
               secondDuplicate
            ]
         })
      ).to.throw('Duplicate vertex id: duplicate')
   })
})
