import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { createVertexId } from '../config/createVertexId'
import { GraphTransformable } from '../graph/GraphTransformable'
import { VertexFieldState } from '../state/VertexFieldState'
import { loadFromFields } from './loadFromFields'

const sut = loadFromFields

const vertexId = createVertexId('test')

const createTransformable = (
   fields: Record<string, any>
): GraphTransformable => ({
   graphData: {
      vertices: {
         [vertexId]: {
            fields,
            reduxState: { vertex: {}, downstream: {} }
         }
      },
      fieldsReactions: [],
      reactions: []
   }
})

describe(sut.name, () => {
   it('loads from picked field', () => {
      const transformable: GraphTransformable = createTransformable({
         name: {
            status: 'loaded',
            value: 'john',
            errors: []
         },
         irrelevant: {
            status: 'loaded',
            value: 'whatever',
            errors: []
         }
      })
      sut(vertexId, ['name'], {
         uppercaseName: (state: any) => {
            expect(state).to.deep.equal({ name: 'john' })
            return of(state.name.toUpperCase())
         }
      })(of(transformable)).subscribe()
   })
   describe('when loading from redux field', () => {
      let receivedUppercaseName$: Subject<string>
      let lastFields: Record<string, VertexFieldState> = {}
      beforeEach(() => {
         receivedUppercaseName$ = new Subject()
         const transformed$ = sut(vertexId, ['name'], {
            uppercaseName: () => receivedUppercaseName$
         })(
            of(
               createTransformable({
                  name: { status: 'loaded', value: 'john', errors: [] }
               })
            )
         )
         transformed$.subscribe(
            _ => (lastFields = _.graphData.vertices[vertexId].fields)
         )
      })
      it('has loading field', () => {
         expect(lastFields.name).to.deep.equal({
            status: 'loaded',
            value: 'john',
            errors: []
         })
         expect(lastFields.uppercaseName).to.deep.equal({
            status: 'loading',
            value: undefined,
            errors: []
         })
      })
      describe('when received uppercase name', () => {
         beforeEach(() => {
            receivedUppercaseName$.next('JOHN')
         })
         it('has loaded field', () => {
            expect(lastFields.uppercaseName).to.deep.equal({
               status: 'loaded',
               value: 'JOHN',
               errors: []
            })
         })
      })
   })
   it('does not call loader when input field is loading', () => {
      sut(vertexId, ['name'], {
         uppercaseName: () => {
            throw new Error('should not be called')
         }
      })(
         of(
            createTransformable({
               name: { status: 'loading', value: undefined, errors: [] }
            })
         )
      ).subscribe()
   })
   describe('when loading from loadable field', () => {
      let input$: Subject<GraphTransformable>
      let receivedUppercaseName$: Subject<string>
      let lastFields: Record<string, VertexFieldState> = {}
      beforeEach(() => {
         input$ = new Subject()
         receivedUppercaseName$ = new Subject()
         const output$ = sut(vertexId, ['name'], {
            uppercaseName: () => receivedUppercaseName$
         })(input$)
         output$.subscribe(
            _ => (lastFields = _.graphData.vertices[vertexId].fields)
         )
         input$.next(
            createTransformable({
               name: { status: 'loading', value: undefined, errors: [] }
            })
         )
      })
      it('has loading field', () => {
         expect(lastFields).to.deep.equal({
            name: {
               status: 'loading',
               value: undefined,
               errors: []
            },
            uppercaseName: {
               status: 'loading',
               value: undefined,
               errors: []
            }
         })
      })
   })
   // TODO when input field is in error
   // TODO when loader throws error
})
