'use strict'

const PER_PAGE = 15

const { resFnImp, slim, request, specImp } = (() => {
  // core
  const url = require('url')
  const https = require('https')
  const { readFileSync } = require('fs')

  // npm
  const JSONStream = require('JSONStream')
  const dotenv = require('dotenv')
  const isObject = require('lodash.isplainobject')
  const transform = require('lodash.transform')

  process.env = { ...process.env, ...dotenv.parse(readFileSync('.env')) }

  const z2 = { _: 1 }
  const emptyFalsy = (z) => !(z && Object.keys(typeof z === 'object' ? z : z2).length)

  const slim = (object) => transform(object, (result, value, key) => {
    if (Array.isArray(value) || isObject(value)) { value = slim(value) }
    if (emptyFalsy(value)) { return }
    if (Array.isArray(result)) { return result.push(value) }
    result[key] = value
  })

  const { name, version } = require('./package.json')
  const opts = {
    ...url.parse('https://api.github.com/graphql'),
    headers: {
      'User-Agent': [name, version].join(' '),
      Authorization: ['bearer', process.env.GITHUB_TOKEN].join(' ')
    }
  }

  return {
    slim,
    specImp: https.get.bind(null, opts),
    request: https.request.bind(null, {
      ...opts,
      method: 'POST'
    }),
    resFnImp: (res, reject, str, cb, all) => res
      .pipe(JSONStream.parse(str))[all ? 'on' : 'once']('data', cb).once('error', reject)
  }
})()

const doit = (login, userFn, vars) => new Promise((resolve, reject) => {
  if (typeof vars === 'object' && !Object.keys(vars).length) { vars = false }
  if (typeof vars !== 'object') { vars = false }
  const dq = {
    query: `query${vars ? ' ($after:String!)' : ''} {
      rateLimit {
        cost
        limit
        nodeCount
        remaining
        resetAt
      }
      user(login:"${login}") {
        following(first: ${PER_PAGE}${vars ? ' , after: $after' : ''}) {
          totalCount
          edges {
            node {
              email
              isHireable
              websiteUrl
              updatedAt
              location
              databaseId
              name
              login
              id
              bio
              repositoriesContributedTo(includeUserRepositories: true, first: 35, orderBy: {field: UPDATED_AT, direction: DESC}) {
                totalCount
                edges {
                  node {
                    description
                    homepageUrl
                    licenseInfo {
                      spdxId
                      name
                    }
                    nameWithOwner
                    owner {
                      login
                      id
                    }
                    databaseId
                    updatedAt
                    languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                      totalCount
                      edges {
                        size
                        node {
                          name
                          color
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`.replace(/ /g, '')
  }

  if (vars) { dq.variables = { after: vars.after } }
  return request((res) => {
    if (res.statusCode !== 200) {
      console.error('HEADERS:', res.headers)
      console.error('VARS:', vars)
      return reject(new Error('Bad status code: ' + res.statusCode))
    }
    res.setEncoding('utf8')
    const ret = { done: 0, headers: res.headers }
    if (vars.allDone) { ret.allDone = vars.allDone }
    res.once('end', () => resolve(ret))
    const resFn = resFnImp.bind(null, res, reject)
    const counter = (user) => {
      ++ret.done
      return userFn(slim(user))
    }
    resFn('data.user.following.edges.*.node', counter, true)
    resFn('data.rateLimit', (rateLimit) => {
      ret.rateLimit = rateLimit
      const sd = Date.parse(res.headers.date)
      ret.rateLimit.serverDate = new Date(sd).toISOString().replace('.000', '')
      const ed = Date.parse(rateLimit.resetAt)
      ret.rateLimit.secondsLeft = Math.round((ed - sd) / 1000)
    })
    resFn('data.user.following.totalCount', (count) => { ret.count = count })
    resFn('data.user.following.pageInfo', (pageInfo) => {
      if (pageInfo.hasNextPage) { ret.after = pageInfo.endCursor }
    })
  })
    .once('error', reject)
    .end(JSON.stringify(dq))
})

const dothem = async (login, userFn, vars) => {
  const now = Date.now()
  const ret = await doit(login, userFn, vars)
  ret.allDone = ret.allDone ? (ret.allDone + ret.done) : ret.done

  if (vars && vars.rateLimit) { console.error('RATELIMIT-vars:', vars.rateLimit) }
  console.error('RATELIMIT-ret:', ret.rateLimit)
  const pagesLeft = ret.rateLimit.remaining / ret.rateLimit.cost
  const pageSpeed = Math.round(1000 * ret.rateLimit.secondsLeft / pagesLeft) / 1000
  console.error('ELAPSED:', Math.round(Date.now() - now), ret.count, ret.allDone, PER_PAGE, ret.count, pageSpeed)

  if (ret.after) { return dothem(login, userFn, ret) }
  if (ret.allDone !== ret.count) { console.error('Warning, incomplete!') }
  return ret
}

const spec = () => new Promise((resolve, reject) =>
  specImp((res) => {
    if (res.statusCode !== 200) { return reject(new Error('Bad status code: ' + res.statusCode)) }
    res.setEncoding('utf8')
    resolve(res)
  })
)

module.exports = { doit, dothem, spec }
