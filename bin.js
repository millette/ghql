'use strict'

// self
const { dothem } = require('.')
// const { doit } = require('.')

const gotUser = (user) => {
  console.log(JSON.stringify(user))
}

dothem(gotUser)
// doit(gotUser)
  .then(console.error)
  .catch(console.error)
