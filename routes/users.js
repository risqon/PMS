var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util')
const bcrypt = require('bcrypt');
const saltRounds = 10;


let usersOptions = {
  id: true,
  name: true,
  email: true,
  position: true,
  type: true,
  status: true
}

module.exports = (db) => {
  router.get('/', helpers.isLoggedIn, function (req, res, next) {
    let link = 'users'
    let user = req.session.user
    const { checkId, userId, checkName, userName, checkEmail, userEmail, checkPosition, userPosition, checkType, userType } = req.query;
    let param = []
    let search = " WHERE boolean=true"

    if (checkId && userId) {
      param.push(`userid=${userId}`)
    }
    if (checkName && userName) {
      param.push(`CONCAT(firstname,' ',lastname) ILIKE '%${userName}%'`)
    }
    if (checkEmail && userEmail) {
      param.push(`email = '${userEmail}'`)
    }
    if (checkPosition && userPosition) {
      param.push(`position = '${userPosition}'`)
    }
    if (checkType && userType) {
      param.push(`typejob = '${userType}'`)
    }
    if (param.length > 0) {
      search += ` AND ${param.join(" AND ")}`
    }
    //console.log(search)

    let sqlUser = `SELECT COUNT (userid) AS total FROM users ${search}`
    //console.log(sqlUser)
    db.query(sqlUser, (err, totalData) => {
      if (err) {
        console.log('error1:', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      const url = req.url == '/' ? '/?page=1' : req.url
      const page = req.query.page || 1
      const limit = 2
      const offset = (page - 1) * limit
      const total = totalData.rows[0].total
      const pages = Math.ceil(total / limit)

      let sqlData = `SELECT userid, CONCAT(firstname,' ',lastname) AS fullname, email, position, status,typejob FROM users ${search} ORDER BY userid ASC LIMIT ${limit} OFFSET ${offset}`

      db.query(sqlData, (err, dataUsers) => {
        if (err) {
          console.log('error2:', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        // console.log(dataUsers)
        res.render('users/list', {
          url,
          user,
          link,
          page,
          pages,
          data: dataUsers.rows,
          user: req.session.user,
          option: usersOptions
        })

      })
    })
  });
  router.get('/delete/:userid', helpers.isLoggedIn, function (req, res, next) {
    const id = req.params.userid

    let delMembers = `DELETE FROM members WHERE userid =${id}`;
    db.query(delMembers, (err) => {
      if (err) {
        console.log('error1', err)
        return res.send(err)
      }
      let delUser = `UPDATE users SET boolean = false WHERE userid = ${id}`
      db.query(delUser, (err) => {
        if (err) {
          console.log('error2', err)
          return res.send(err)
        }
        res.redirect('/users')
      })
    });
  })

  router.post('/', helpers.isLoggedIn, function (req, res) {
    usersOptions.id = req.body.checkid
    usersOptions.name = req.body.checkname
    usersOptions.email = req.body.checkemail
    usersOptions.position = req.body.checkposition
    usersOptions.type = req.body.checktype
    usersOptions.status = req.body.checkstatus
    res.redirect('/users')
  });

  router.get('/add', helpers.isLoggedIn, function (req, res, next) {
    let link = 'users'
    res.render('users/add', {
      link,
      user: req.session.user
    });
  });

  router.post('/add', helpers.isLoggedIn, function (req, res) {
    const { email, password, fname, lname, position, status, type } = req.body
    // console.log(req.body)
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        console.log('error1', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      let sql = `INSERT INTO users (email,password,firstname, lastname,  position, status, typejob, boolean) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
      let values = [email, hash, fname, lname, position, status, type, true]
      // console.log(sql)
      // console.log(values)
      db.query(sql, values, (err) => {
        if (err) {
          console.log('error2', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        res.redirect('/users')
      })
    })
  })

  router.get('/edit/:userid', helpers.isLoggedIn, function (req, res, next) {
    let link = 'users'
    let id = req.params.userid
    let sql = `SELECT * FROM users WHERE userid=${id}`
    db.query(sql, (err, data) => {
      if (err) return res.status(500)

      res.render('users/edit', {
        link,
        user: req.session.user,
        result: data.rows[0]
      });
    });
  })

  router.post('/edit/:userid', helpers.isLoggedIn, function (req, res, next) {
    const { password, fname, lname, position, status, type } = req.body
    let id = req.params.userid
    //console.log(req.body)
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        console.log('error1', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }
      //console.log(hast)
      let sql = `UPDATE users SET password = $1,firstname = $2, lastname =$3,  position = $4, status = $5, typejob = $6, boolean = $7 WHERE userid =$8`
      let values = [hash, fname, lname, position, status, type, true, id]
      //console.log(sql)
      //console.log(values)
      db.query(sql, values, (err) => {
        if (err) {
          console.log('error2', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        res.redirect('/users')
      })
    })
  })
  return router;
}

