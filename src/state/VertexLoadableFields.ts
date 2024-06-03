import { VertexStatus } from '../VertexStatus'

export type VertexLoadableFields<
   LoadableFields extends object = Record<string, any>,
   Status extends VertexStatus = VertexStatus
> = Status extends 'loading'
   ? {
        [K in keyof LoadableFields]:
           | {
                status: 'loading'
                value: undefined
                error: undefined
                // TODO
                //   inputs: Record<string,any>
             }
           | {
                status: 'loaded'
                value: LoadableFields[K]
                error: undefined
                // TODO
                //   inputs: Record<string,any>
             }
     }
   : Status extends 'loaded'
   ? {
        [K in keyof LoadableFields]: {
           status: 'loaded'
           value: LoadableFields[K]
           error: undefined
           // TODO
           //   inputs: Record<string,any>
        }
     }
   : Status extends 'error'
   ? {
        [K in keyof LoadableFields]:
           | {
                status: 'loading'
                value: undefined
                error: undefined
                // TODO
                //   inputs: Record<string,any>
             }
           | {
                status: 'loaded'
                value: LoadableFields[K]
                error: undefined
                // TODO
                //   inputs: Record<string,any>
             }
           | {
                status: 'error'
                value: undefined
                error: Error
                // TODO
                //   inputs: Record<string,any>
             }
     }
   : never
