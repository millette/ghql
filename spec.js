'use strict'

// self
const { spec } = require('.')

spec()
  .then((res) => new Promise((resolve, reject) => res
    .once('end', resolve)
    .pipe(process.stdout)
    .once('error', reject)
  ))
  .then(() => console.error('All good.'))
  .catch(console.error)
