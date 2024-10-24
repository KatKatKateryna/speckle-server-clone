import { authorizeResolver } from '@/modules/shared'
import { isNonNullable, Roles } from '@speckle/shared'
import { Resolvers } from '@/modules/core/graph/generated/graphql'
import {
  getObjectChildrenFactory,
  getObjectChildrenQueryFactory,
  getObjectFactory,
  storeClosuresIfNotFoundFactory,
  storeObjectsIfNotFoundFactory
} from '@/modules/core/repositories/objects'
import { db } from '@/db/knex'
import { createObjectsFactory } from '@/modules/core/services/objects/management'

const getObject = getObjectFactory({ db })
const createObjects = createObjectsFactory({
  storeObjectsIfNotFoundFactory: storeObjectsIfNotFoundFactory({ db }),
  storeClosuresIfNotFound: storeClosuresIfNotFoundFactory({ db })
})
const getObjectChildren = getObjectChildrenFactory({ db })
const getObjectChildrenQuery = getObjectChildrenQueryFactory({ db })
type GetObjectChildrenQueryParams = Parameters<typeof getObjectChildrenQuery>[0]

const getStreamObject: NonNullable<Resolvers['Stream']>['object'] =
  async function object(parent, args) {
    return (await getObject(args.id, parent.id)) || null
  }

export = {
  Stream: {
    object: getStreamObject
  },
  Project: {
    object: getStreamObject
  },
  Object: {
    async children(parent, args) {
      // The simple query branch
      if (!args.query && !args.orderBy) {
        const result = await getObjectChildren({
          streamId: parent.streamId,
          objectId: parent.id,
          limit: args.limit,
          depth: args.depth,
          select: args.select?.filter(isNonNullable),
          cursor: args.cursor
        })

        // Hacky typing here, but I want to avoid filling up memory with a new array of new objects w/ .map()
        const objects = result.objects as Array<
          (typeof result)['objects'][number] & {
            streamId: string
          }
        >
        objects.forEach((x) => (x.streamId = parent.streamId))

        return {
          totalCount: parent.totalChildrenCount || 0,
          cursor: result.cursor,
          objects
        }
      }

      // The complex query branch
      const result = await getObjectChildrenQuery({
        streamId: parent.streamId,
        objectId: parent.id,
        limit: args.limit,
        depth: args.depth,
        select: args.select?.filter(isNonNullable),
        // TODO: Theoretically users can feed in invalid structures here
        query: args.query?.filter(
          isNonNullable
        ) as GetObjectChildrenQueryParams['query'],
        orderBy: (args.orderBy || undefined) as GetObjectChildrenQueryParams['orderBy'],
        cursor: args.cursor
      })

      // Hacky typing here, but I want to avoid filling up memory with a new array of new objects w/ .map()
      const objects = result.objects as Array<
        (typeof result)['objects'][number] & {
          streamId: string
        }
      >
      objects.forEach((x) => (x.streamId = parent.streamId))

      return {
        ...result,
        objects
      }
    }
  },
  Mutation: {
    async objectCreate(_parent, args, context) {
      await authorizeResolver(
        context.userId,
        args.objectInput.streamId,
        Roles.Stream.Contributor,
        context.resourceAccessRules
      )

      const ids = await createObjects({
        streamId: args.objectInput.streamId,
        objects: args.objectInput.objects.filter(isNonNullable)
      })
      return ids
    }
  }
} as Resolvers
