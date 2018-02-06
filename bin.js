'use strict'

// self
const { dothem } = require('.')

const gotUser = (user) => {
  console.log('user:', user)
}

dothem(gotUser)
  .then(console.log)
  .catch(console.error)
