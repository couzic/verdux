import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { Vertex } from '../vertex/Vertex'
import { createGraph } from './createGraph'

describe(createGraph.name, () => {
   describe('root vertex', () => {
      const rootVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'root',
            initialState: {
               name: ''
            },
            reducers: {
               setName: (state, action: PayloadAction<string>) => {
                  state.name = action.payload
               }
            }
         })
      })
      let latestState: any
      let latestLoadableState: any
      let latestPick: any
      it('creates graph', () => {
         const graph = createGraph({
            vertices: [rootVertexConfig]
         })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         rootVertex.state$.subscribe(state => {
            latestState = state
         })
         rootVertex.loadableState$.subscribe(loadableState => {
            latestLoadableState = loadableState
         })
         rootVertex.pick(['name']).subscribe(pick => {
            latestPick = pick
         })
         expect(rootVertex.id).to.equal(rootVertexConfig.id)
         expect(rootVertex.currentState).to.deep.equal({ name: '' })
         const expectedLoadableState = {
            status: 'loaded',
            errors: [],
            state: { name: '' },
            fields: {
               name: {
                  status: 'loaded',
                  value: '',
                  errors: []
               }
            }
         }
         expect(rootVertex.currentLoadableState).to.deep.equal(
            expectedLoadableState
         )
         expect(latestState).to.deep.equal({ name: '' })
         expect(latestLoadableState).to.deep.equal(expectedLoadableState)
         expect(latestPick).to.deep.equal(expectedLoadableState)
      })
      it('creates graph without default redux middleware', () => {
         createGraph({
            vertices: [rootVertexConfig],
            excludeDefaultReduxMiddleware: true
         })
      })
      describe('single downstream vertex', () => {
         const downstreamVertexConfig =
            rootVertexConfig.configureDownstreamVertex({
               slice: createSlice({
                  name: 'downstreamVertex',
                  initialState: {
                     downstreamName: ''
                  },
                  reducers: {
                     setLastName: (state, action: PayloadAction<string>) => {
                        state.downstreamName = action.payload
                     }
                  }
               })
            })
         it('has fields from redux state', () => {
            const graph = createGraph({
               vertices: [rootVertexConfig, downstreamVertexConfig]
            })
            const downstreamVertex = graph.getVertexInstance(
               downstreamVertexConfig
            )
            expect(downstreamVertex.currentState).to.deep.equal({
               downstreamName: ''
            })
         })
      })
      describe('single downstream vertex with field from upstream vertex', () => {
         const downstreamVertexConfig =
            rootVertexConfig.configureDownstreamVertex({
               slice: createSlice({
                  name: 'downstream',
                  initialState: {},
                  reducers: {}
               }),
               upstreamFields: ['name']
            })
         it('passes down upstream field', () => {
            const graph = createGraph({
               vertices: [rootVertexConfig, downstreamVertexConfig]
            })
            const downstreamVertex = graph.getVertexInstance(
               downstreamVertexConfig
            )
            expect(downstreamVertex.currentState).to.deep.equal({
               name: ''
            })
         })
      })
   })
   describe('root vertex with computed field', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {
            name: ''
         },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            }
         }
      })
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice
      }).computeFromFields(['name'], {
         uppercaseName: ({ name }) => name.toUpperCase()
      })
      it('computes field', () => {
         const graph = createGraph({
            vertices: [rootVertexConfig]
         })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         expect(rootVertex.currentState).to.deep.equal({
            name: '',
            uppercaseName: ''
         })
         graph.dispatch(rootSlice.actions.setName('John'))
         expect(rootVertex.currentState).to.deep.equal({
            name: 'John',
            uppercaseName: 'JOHN'
         })
      })
   })
   describe('root vertex with loaded field', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {
            name: ''
         },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            }
         }
      })
      let receivedUppercaseName$: Subject<string>
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice
      }).loadFromFields(['name'], {
         uppercaseName: state => {
            expect(Object.keys(state)).to.deep.equal(['name'])
            return receivedUppercaseName$
         }
      })
      it('loads field', () => {
         receivedUppercaseName$ = new Subject()
         const graph = createGraph({
            vertices: [rootVertexConfig]
         })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         graph.dispatch(rootSlice.actions.setName('John'))
         expect(rootVertex.currentLoadableState.status).to.equal('loading')
         expect(rootVertex.currentState).to.deep.equal({
            name: 'John',
            uppercaseName: undefined
         })
      })
   })
   describe('root vertex loading from nullable field', () => {
      const dataMapVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'dataMap',
            initialState: { clickedDept: null as null | number },
            reducers: {}
         })
      }).loadFromFields(['clickedDept'], {
         deptData: () => of(null)
      })
      it('picks from nullable field', () => {
         const graph = createGraph({
            vertices: [dataMapVertexConfig]
         })
         const vertex = graph.getVertexInstance(dataMapVertexConfig)
         let pickedEmissions = 0
         vertex.pick(['clickedDept']).subscribe(() => {
            pickedEmissions++
         })
         expect(pickedEmissions).to.equal(1)
      })
   })
   describe('root vertex with reaction', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {
            name: '',
            nameLength: 0
         },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            },
            setNameLength: (state, action: PayloadAction<number>) => {
               state.nameLength = action.payload
            }
         }
      })
      const { setName, setNameLength } = rootSlice.actions
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice
      }).reaction(setName, ({ payload }) => setNameLength(payload.length))
      it('does not consume field change of original field', () => {
         const graph = createGraph({ vertices: [rootVertexConfig] })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         let pickEmissions = 0
         rootVertex.pick(['name']).subscribe(() => {
            pickEmissions++
         })
         graph.dispatch(setName('John'))
         expect(pickEmissions).to.equal(2)
      })
   })
   describe('root vertex with field reaction', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {
            name: '',
            nameLength: 0
         },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            },
            setNameLength: (state, action: PayloadAction<number>) => {
               state.nameLength = action.payload
            }
         }
      })
      const { setName, setNameLength } = rootSlice.actions
      let reactions = 0
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice
      }).fieldsReaction(['name'], ({ name }) => {
         reactions++
         return setNameLength(name.length)
      })
      it('reacts on first field changed after initial run', () => {
         const graph = createGraph({ vertices: [rootVertexConfig] })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         expect(rootVertex.currentState.nameLength).to.equal(0)
         graph.dispatch(setName('John'))
         expect(rootVertex.currentState.nameLength).to.equal(4)
         expect(reactions).to.equal(1)
      })
      it('does not consume field change of original field', () => {
         const graph = createGraph({ vertices: [rootVertexConfig] })
         const rootVertex = graph.getVertexInstance(rootVertexConfig)
         let pickEmissions = 0
         rootVertex.pick(['name']).subscribe(() => {
            pickEmissions++
         })
         graph.dispatch(setName('John'))
         expect(pickEmissions).to.equal(2)
      })
   })
   describe('root vertex with side effect', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {
            name: '',
            nameLength: 0
         },
         reducers: {
            setName: (state, action: PayloadAction<string>) => {
               state.name = action.payload
            }
         }
      })
      const { setName } = rootSlice.actions
      let effectTriggered = false
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice
      }).sideEffect(setName, ({ payload }) => {
         effectTriggered = true
      })
      it('does not consume field change of original field', () => {
         const graph = createGraph({ vertices: [rootVertexConfig] })
         graph.dispatch(setName('John'))
         expect(effectTriggered).to.be.true
      })
   })
   describe('root vertex with dependencies', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      })
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice,
         dependencies: {
            name: () => 'Bob'
         }
      }).withDependencies((dependencies, config) => {
         expect(dependencies).to.deep.equal({ name: 'Bob' })
         return config.load({ loadedName: of(dependencies.name) })
      })
      let vertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         const graph = createGraph({ vertices: [rootVertexConfig] })
         vertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('provides access to dependency', () => {
         expect(vertex.currentState).to.deep.equal({ loadedName: 'Bob' })
      })
      it('exposes vertex dependencies', () => {
         expect(vertex.dependencies.name).to.equal('Bob')
      })
   })
   describe('root vertex with INJECTED dependencies', () => {
      const rootSlice = createSlice({
         name: 'root',
         initialState: {},
         reducers: {}
      })
      const rootVertexConfig = configureRootVertex({
         slice: rootSlice,
         dependencies: {
            name: () => 'Bob'
         }
      })
      let vertex: Vertex<typeof rootVertexConfig>
      beforeEach(() => {
         const graph = createGraph({
            vertices: [rootVertexConfig.injectedWith({ name: 'Steve' })]
         })
         vertex = graph.getVertexInstance(rootVertexConfig)
      })
      it('exposes injected vertex dependencies', () => {
         expect(vertex.dependencies.name).to.equal('Steve')
      })
   })
   it('.computeFromFields$() supports immediately emitting computer', () => {
      const periodSliderVertexConfig = configureRootVertex({
         slice: createSlice({
            name: 'periodSlider',
            initialState: { startYearInputValue: '2013' },
            reducers: {}
         })
      }).computeFromFields$(['startYearInputValue'], {
         startYear: () => of('2014')
      })

      const graph = createGraph({
         vertices: [periodSliderVertexConfig]
      })
      const vertex = graph.getVertexInstance(periodSliderVertexConfig)

      expect(vertex.currentState.startYear).to.equal('2014')
   })
})
