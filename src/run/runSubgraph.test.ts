import { PayloadAction, createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { configureRootVertex } from '../config/configureRootVertex'
import { GraphInfo } from './GraphInfo'
import { GraphRunData } from './RunData'
import { runSubgraph } from './runSubgraph'

describe(runSubgraph.name, () => {
   it('handles simplest case', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }) as VertexConfigImpl
      const graphInfo: GraphInfo = {
         vertexConfigsByClosestCommonAncestorId: { [rootVertexConfig.id]: [] },
         vertexIdsInSubgraph: { [rootVertexConfig.id]: [rootVertexConfig.id] },
         trackedActionsInSubgraph: { [rootVertexConfig.id]: [] },
         dependenciesByVertexId: { [rootVertexConfig.id]: {} }
      }
      const graphRun = runSubgraph(rootVertexConfig, graphInfo)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: {},
               downstream: {}
            }
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {}
      }
      const input$ = new Subject<GraphRunData>()
      graphRun(input$).subscribe(output => (lastOutput = output))
      input$.next(input)
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: { [rootVertexConfig.id]: {} },
         changedFieldsByVertexId: { [rootVertexConfig.id]: {} }
      })
   })

   it('handles single downstream vertex', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }) as VertexConfigImpl
      const downstreamVertexConfig = rootVertexConfig.configureDownstreamVertex(
         {
            slice: createSlice({
               name: 'downstreamVertexName',
               initialState: {},
               reducers: {}
            })
         }
      ) as VertexConfigImpl
      const graphInfo: GraphInfo = {
         vertexConfigsByClosestCommonAncestorId: {
            [rootVertexConfig.id]: [downstreamVertexConfig],
            [downstreamVertexConfig.id]: []
         },
         vertexIdsInSubgraph: {
            [rootVertexConfig.id]: [
               rootVertexConfig.id,
               downstreamVertexConfig.id
            ],
            [downstreamVertexConfig.id]: [downstreamVertexConfig.id]
         },
         trackedActionsInSubgraph: {
            [rootVertexConfig.id]: [],
            [downstreamVertexConfig.id]: []
         },
         dependenciesByVertexId: { [rootVertexConfig.id]: {} }
      }
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: {},
               downstream: {
                  downstreamVertexName: { vertex: {}, downstream: {} }
               }
            },
            [downstreamVertexConfig.id]: { vertex: {}, downstream: {} }
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {}
      }
      let outputEmissions = 0
      const input$ = new Subject<GraphRunData>()
      runSubgraph(
         rootVertexConfig,
         graphInfo
      )(input$).subscribe(output => {
         lastOutput = output
         outputEmissions++
      })

      input$.next(input)
      expect(outputEmissions).to.equal(1)
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {}
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {}
         }
      })

      input$.next(input)
      expect(outputEmissions).to.equal(2)
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {}
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {}
         }
      })
   })

   it('handles downstream tracked action', () => {
      const trackedAction = createAction('trackedAction')
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }) as VertexConfigImpl
      const downstreamSlice = createSlice({
         name: 'downstreamVertexName',
         initialState: { name: '' },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            }
         }
      })
      const downstreamVertexConfig = rootVertexConfig
         .configureDownstreamVertex({
            slice: downstreamSlice as any
         })
         .reaction(trackedAction, () =>
            downstreamSlice.actions.setName('Bob')
         ) as VertexConfigImpl
      const graphInfo: GraphInfo = {
         vertexConfigsByClosestCommonAncestorId: {
            [rootVertexConfig.id]: [downstreamVertexConfig],
            [downstreamVertexConfig.id]: []
         },
         vertexIdsInSubgraph: {
            [rootVertexConfig.id]: [
               rootVertexConfig.id,
               downstreamVertexConfig.id
            ],
            [downstreamVertexConfig.id]: [downstreamVertexConfig.id]
         },
         trackedActionsInSubgraph: {
            [rootVertexConfig.id]: [trackedAction],
            [downstreamVertexConfig.id]: [trackedAction]
         },
         dependenciesByVertexId: { [rootVertexConfig.id]: {} }
      }
      const graphRun = runSubgraph(rootVertexConfig, graphInfo)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: trackedAction(),
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: {},
               downstream: {
                  downstreamVertexName: { vertex: { name: '' }, downstream: {} }
               }
            },
            [downstreamVertexConfig.id]: {
               vertex: { name: '' },
               downstream: {}
            }
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {}
      }
      const input$ = new Subject<GraphRunData>()
      graphRun(input$).subscribe(output => (lastOutput = output))
      input$.next(input)
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: {
               name: { status: 'loaded', value: '', errors: [] }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {},
            [downstreamVertexConfig.id]: { name: true }
         },
         reactions: [downstreamSlice.actions.setName('Bob')]
      })
   })
})