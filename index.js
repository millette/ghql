'use strict'

// core
const https = require('https')

// npm
const JSONStream = require('JSONStream')

const setup = () => {
  const { readFileSync } = require('fs')
  const { parse } = require('dotenv')
  const url = require('url')
  process.env = { ...process.env, ...parse(readFileSync('.env')) }
  const { name, version } = require('./package.json')
  return {
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

const PER_PAGE = 5

const { request } = setup()

const resFnImp = (res, reject, str, cb, all) => res
  .pipe(JSONStream.parse(str))[all ? 'on' : 'once']('data', cb).once('error', reject)

const doit = (dq, userFn) => new Promise(
  (resolve, reject) => request((res) => {
    if (res.statusCode !== 200) { return reject(new Error('Bad status code: ' + res.statusCode)) }
    res.setEncoding('utf8')
    const ret = { headers: res.headers }
    res.once('end', () => resolve(ret))
    const resFn = resFnImp.bind(null, res, reject)
    resFn('data.user.following.edges.*.node', userFn, true)
    resFn('data.rateLimit', (rateLimit) => { ret.rateLimit = rateLimit })
    resFn('data.user.following.totalCount', (count) => { ret.count = count })
    resFn('data.user.following.pageInfo', (pageInfo) => {
      if (pageInfo.hasNextPage) { ret.after = pageInfo.endCursor }
    })
  })
    .once('error', reject)
    .end(JSON.stringify(dq))
)

const gotUser = (user) => {
  console.log('user:', user)
}

// make this the doit() argument
// const VARIABLES = { nextUp: 'Y3Vyc29yOnYyOpHOAdVehQ==' }
const VARIABLES = false

// move into doit() implementation
const dataQuery = {
  query: `query${VARIABLES ? ' ($nextUp:String!)' : ''} {
    rateLimit {
      cost
      limit
      nodeCount
      remaining
      resetAt
    }
    user(login:"ghqc") {
      following(first: ${PER_PAGE}${VARIABLES ? ' , after: $nextUp' : ''}) {
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
  }
  `.replace(/ /g, ''),
  variables: VARIABLES || {}
}

// doit(gotUser, vars) // with dataQuery in the implementation
doit(dataQuery, gotUser)
  .then(console.log)
  .catch(console.error)
