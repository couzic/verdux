import { expect } from 'chai'
import { of } from 'rxjs'
import { createVertexId } from '../config/createVertexId'
import { VertexTransformable } from '../graph/Transformable'
import { computeFromFields } from './computeFromFields'

const sut = computeFromFields

const vertexId = createVertexId('test')

const createTransformable = (
   vertexFields: Record<string, any>
): VertexTransformable => ({
   vertexFields,
   fieldsReactions: [],
   reactions: []
})

describe(sut.name, () => {
   it('computes from picked field', () => {
      const transformable = createTransformable({
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
            return state.name.toUpperCase()
         }
      })(of(transformable)).subscribe()
   })
   it('computes from loading field', () => {
      const transformable = createTransformable({
         name: {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      let transformed: VertexTransformable = {} as any
      sut(vertexId, ['name'], {
         uppercaseName: () => {
            throw new Error('should not be called')
         }
      })(of(transformable)).subscribe(_ => (transformed = _))
      expect(transformed.vertexFields).to.deep.equal({
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
   it('computes from field in error', () => {
      const error = new Error('Some random error')
      const transformable = createTransformable({
         name: {
            status: 'error',
            value: undefined,
            errors: [error]
         }
      })
      let transformed: VertexTransformable = {} as any
      sut(vertexId, ['name'], {
         uppercaseName: () => {
            throw new Error('should not be called')
         }
      })(of(transformable)).subscribe(_ => (transformed = _))
      expect(transformable.vertexFields.uppercaseName).to.deep.equal({
         status: 'error',
         value: undefined,
         errors: [error]
      })
   })
})
