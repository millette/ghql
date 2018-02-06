'use strict'

// self
const { dothem } = require('.')

const gotUser = (user) => {
  console.log(JSON.stringify(user))
}

dothem(gotUser)
  .then(console.error)
  .catch(console.error)
