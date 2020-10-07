var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util')
const bcrypt = require('bcrypt')
const saltRounds = 10

module.exports = (db) => {

  router.get('/', helpers.isLoggedIn, function (req, res, next) {
    let link = 'profile'
    let user = req.session.user

    let sql = `SELECT * FROM users WHERE email = '${user.email}'`

    db.query(sql, (err, data) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      //console.log(data)
      res.render('profile/form', {
        user,
        link,
        data: data.rows[0],
        user: req.session.user
      })
    });
  })

  router.post('/', helpers.isLoggedIn, function (req, res, next) {

    let user = req.session.user
    const { password, position, type } = req.body
    console.log(req.body)
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        console.log('error2', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      let sql = `UPDATE users SET password = $1 ,position= $2 , typejob= $3 WHERE email = $4`
      let value = [hash, position, type, user.email]
      console.log(sql)
      console.log(value)
      db.query(sql, value, (err) => {
        if (err) {
          console.log('error2', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        res.redirect('/profile')
      });
    })
  })

  return router;
}
