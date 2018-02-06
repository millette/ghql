'use strict'

// self
const ghql = require('.')

const gotUser = (user) => {
  console.log('user:', user)
}

ghql.dothem(gotUser)
  .then(console.log)
  .catch(console.error)
