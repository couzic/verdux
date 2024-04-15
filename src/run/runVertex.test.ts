import { PayloadAction, createAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { map, of } from 'rxjs'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { configureRootVertex } from '../config/configureRootVertex'
import { GraphRunData } from './RunData'
import { runVertex } from './runVertex'

describe(runVertex.name, () => {
   it('handles simplest case', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }) as VertexConfigImpl
      const graphRun = runVertex(rootVertexConfig)
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
      const input$ = of(input)
      graphRun(input$).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         changedFieldsByVertexId: { [rootVertexConfig.id]: {} }
      })
   })

   it('extracts redux field', () => {
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
      const graphRun = runVertex(rootVertexConfig)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
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
      const input$ = of(input)
      graphRun(input$).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: true
            }
         }
      })
   })

   it('computes from loaded field', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: { name: 'Bob' },
            reducers: {}
         })
      }).computeFromFields(['name'], {
         uppercaseName: ({ name }) => name.toUpperCase()
      }) as unknown as VertexConfigImpl
      const graphRun = runVertex(rootVertexConfig)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: undefined,
         fieldsReactions: [],
         reactions: [],
         reduxStateByVertexId: {
            [rootVertexConfig.id]: {
               vertex: { name: 'Bob' },
               downstream: {}
            }
         },
         fieldsByVertexId: {},
         changedFieldsByVertexId: {}
      }
      const input$ = of(input)
      graphRun(input$).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: { status: 'loaded', value: 'Bob', errors: [] },
               uppercaseName: { status: 'loaded', value: 'BOB', errors: [] }
            }
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {
               name: true,
               uppercaseName: true
            }
         }
      })
   })

   it('outputs reaction', () => {
      const trackedAction = createAction('trackedAction')
      const outputAction = createAction('outputAction')
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }).reaction(trackedAction, () => outputAction()) as VertexConfigImpl
      const graphRun = runVertex(rootVertexConfig)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: trackedAction(),
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
      const input$ = of(input)
      graphRun(input$).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         reactions: [outputAction()]
      })
   })

   it('handles reaction stream', () => {
      const trackedAction = createAction('trackedAction')
      const outputAction = createAction('outputAction')
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {},
            reducers: {}
         })
      }).reaction$(
         trackedAction,
         map(() => outputAction())
      ) as VertexConfigImpl
      const graphRun = runVertex(rootVertexConfig)
      let lastOutput: GraphRunData | undefined = undefined
      const input: GraphRunData = {
         action: trackedAction(),
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
      const input$ = of(input)
      graphRun(input$).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         action: undefined,
         fieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         changedFieldsByVertexId: {
            [rootVertexConfig.id]: {}
         },
         reactions: [outputAction()]
      })
   })
})
