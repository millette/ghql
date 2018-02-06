'use strict'

const PER_PAGE = 100
const USER = 'millette' // 'ghqc'

// core
const https = require('https')

// npm
const JSONStream = require('JSONStream')
const pick = require('lodash.pickby')

const slim = (user) => pick(user, Boolean)

const setup = () => {
  const { readFileSync } = require('fs')
  const { parse } = require('dotenv')
  const url = require('url')
  process.env = { ...process.env, ...parse(readFileSync('.env')) }
  const { name, version } = require('./package.json')
  return {
    spec: https.request.bind(null, {
      ...url.parse('https://api.github.com/graphql'),
      headers: {
        'User-Agent': name + ' ' + version,
        Authorization: 'bearer ' + process.env.GITHUB_TOKEN
      }
    }),
    request: https.request.bind(null, {
      method: 'POST',
      ...url.parse('https://api.github.com/graphql'),
      headers: {
        'User-Agent': name + ' ' + version,
        Authorization: 'bearer ' + process.env.GITHUB_TOKEN
      }
    })
  }
}

const { request, spec } = setup()
const resFnImp = (res, reject, str, cb, all) => res
  .pipe(JSONStream.parse(str))[all ? 'on' : 'once']('data', cb).once('error', reject)

const doit = (userFn, vars) => new Promise((resolve, reject) => {
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
      user(login:"${USER}") {
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
            }
            cursor
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }`.replace(/ /g, '')
  }
  if (vars) { dq.variables = vars }
  return request((res) => {
    if (res.statusCode !== 200) { return reject(new Error('Bad status code: ' + res.statusCode)) }
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
    resFn('data.rateLimit', (rateLimit) => { ret.rateLimit = rateLimit })
    resFn('data.user.following.totalCount', (count) => { ret.count = count })
    resFn('data.user.following.pageInfo', (pageInfo) => {
      if (pageInfo.hasNextPage) { ret.after = pageInfo.endCursor }
    })
  })
    .once('error', reject)
    .end(JSON.stringify(dq))
})

const dothem = async (userFn, vars) => {
  const ret = await doit(userFn, vars)
  ret.allDone = ret.allDone ? (ret.allDone + ret.done) : ret.done
  if (ret.after) { return dothem(userFn, ret) }
  if (ret.allDone !== ret.count) { console.error('Warning, incomplete!') }
  return ret
}

const specImp = () => new Promise((resolve, reject) =>
  spec((res) => {
    if (res.statusCode !== 200) { return reject(new Error('Bad status code: ' + res.statusCode)) }
    res.setEncoding('utf8')
    resolve(res)
  }).end()
)

module.exports = { doit, dothem, spec: specImp }
