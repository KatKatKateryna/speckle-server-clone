import {
  createUser,
  validatePasssword,
  getUserByEmail
} from '@/modules/core/services/users'
import { getServerInfo } from '@/modules/core/services/generic'
import {
  sendRateLimitResponse,
  getRateLimitResult,
  isRateLimitBreached
} from '@/modules/core/services/ratelimiter'
import {
  validateServerInviteFactory,
  finalizeInvitedServerRegistrationFactory,
  resolveAuthRedirectPathFactory
} from '@/modules/serverinvites/services/processing'
import { getIpFromRequest } from '@/modules/shared/utils/ip'
import { NoInviteFoundError } from '@/modules/serverinvites/errors'
import { UserInputError, PasswordTooShortError } from '@/modules/core/errors/userinput'
import {
  findServerInviteFactory,
  deleteServerOnlyInvitesFactory,
  updateAllInviteTargetsFactory
} from '@/modules/serverinvites/repositories/serverInvites'
import db from '@/db/knex'
import { ServerInviteResourceType } from '@/modules/serverinvites/domain/constants'
import { getResourceTypeRole } from '@/modules/serverinvites/helpers/core'
import { AuthStrategyMetadata, AuthStrategyBuilder } from '@/modules/auth/helpers/types'
import { ServerInviteRecord } from '@/modules/serverinvites/domain/types'
import { ensureError, Optional } from '@speckle/shared'

const localStrategyBuilder: AuthStrategyBuilder = async (
  app,
  sessionMiddleware,
  moveAuthParamsToSessionMiddleware,
  finalizeAuthMiddleware
) => {
  const strategy: AuthStrategyMetadata = {
    id: 'local',
    name: 'Local',
    icon: 'TODO',
    color: 'accent',
    url: '/auth/local'
  }

  // POST Login
  app.post(
    '/auth/local/login',
    sessionMiddleware,
    moveAuthParamsToSessionMiddleware,
    async (req, res, next) => {
      try {
        const valid = await validatePasssword({
          email: req.body.email,
          password: req.body.password
        })

        if (!valid) throw new UserInputError('Invalid credentials.')

        const user = await getUserByEmail({ email: req.body.email })
        if (!user) throw new UserInputError('Invalid credentials.')
        req.user = { id: user.id, email: user.email }

        return next()
      } catch (err) {
        req.log.info({ err }, 'Error while logging in.')
        return res.status(401).send({ err: true, message: 'Invalid credentials.' })
      }
    },
    finalizeAuthMiddleware
  )

  // POST Register
  app.post(
    '/auth/local/register',
    sessionMiddleware,
    moveAuthParamsToSessionMiddleware,
    async (req, res, next) => {
      const serverInfo = await getServerInfo()
      try {
        if (!req.body.password) throw new UserInputError('Password missing')

        const user = req.body
        const ip = getIpFromRequest(req)
        if (ip) user.ip = ip
        const source = ip ? ip : 'unknown'
        const rateLimitResult = await getRateLimitResult('USER_CREATE', source)
        if (isRateLimitBreached(rateLimitResult)) {
          return sendRateLimitResponse(res, rateLimitResult)
        }

        // 1. if the server is invite only you must have an invite
        if (serverInfo.inviteOnly && !req.session.token)
          throw new UserInputError(
            'This server is invite only. Please provide an invite id.'
          )

        // 2. if you have an invite it must be valid, both for invite only and public servers
        let invite: Optional<ServerInviteRecord> = undefined
        if (req.session.token) {
          invite = await validateServerInviteFactory({
            findServerInvite: findServerInviteFactory({ db })
          })(user.email, req.session.token)
        }

        // 3. at this point we know, that we have one of these cases:
        //    * the server is invite only and the user has a valid invite
        //    * the server public and the user has a valid invite
        //    * the server public and the user doesn't have an invite
        // so we go ahead and register the user
        const userId = await createUser({
          ...user,
          role: invite
            ? getResourceTypeRole(invite.resource, ServerInviteResourceType)
            : undefined
        })
        req.user = {
          id: userId,
          email: user.email,
          isNewUser: true,
          isInvite: !!invite
        }
        req.log = req.log.child({ userId })

        // 4. use up all server-only invites the email had attached to it
        await finalizeInvitedServerRegistrationFactory({
          deleteServerOnlyInvites: deleteServerOnlyInvitesFactory({ db }),
          updateAllInviteTargets: updateAllInviteTargetsFactory({ db })
        })(user.email, userId)

        // Resolve redirect path
        req.authRedirectPath = resolveAuthRedirectPathFactory()(invite)

        return next()
      } catch (err) {
        const e = ensureError(err, 'Unexpected issue occured while registering')
        switch (e.constructor) {
          case PasswordTooShortError:
          case UserInputError:
          case NoInviteFoundError:
            req.log.info({ err }, 'Error while registering.')
            return res.status(400).send({ err: e.message })
          default:
            req.log.error(err, 'Error while registering.')
            return res.status(500).send({ err: e.message })
        }
      }
    },
    finalizeAuthMiddleware
  )

  return strategy
}

export = localStrategyBuilder