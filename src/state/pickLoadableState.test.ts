import { expect } from 'chai'
import { pickLoadableState } from './pickLoadableState'
import { VertexLoadableState } from './VertexLoadableState'

describe(pickLoadableState.name, () => {
   it('picks fields', () => {
      const loadableState: VertexLoadableState<{
         name: { loadable: false; value: string }
         age: { loadable: false; value: number }
      }> = {
         status: 'loaded',
         errors: [],
         state: { name: '', age: 0 },
         fields: {
            name: {
               status: 'loaded',
               value: '',
               errors: []
            },
            age: { status: 'loaded', value: 0, errors: [] }
         }
      }
      expect(pickLoadableState(loadableState, ['name'])).to.deep.equal({
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
      })
   })
})
