var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports = (db) => {

  router.get('/', function (req, res, next) {
    res.render('login', { title: 'Express' });
  });

  router.post('/login', function (req, res, next) {
    const { email, password } = req.body;
    db.query('select * from users where email = $1', [email], (err, data) => {
      if (err) return res.send('terjadi kesalahan, coba lagi nanti');

      if (data.rows.length == 0) return res.send("email doesn't exist");

      bcrypt.compare(password, data.rows[0].password, function (err, result) {
        if (err) return res.send('terjadi kesalahan, coba lagi nanti');
        //console.log(result)
        if (result) {
          delete data.rows[0].password
          req.session.user = data.rows[0]
          res.redirect('/projects');
        } else {
          res.redirect('/')
        }
      });
    })
  });

  router.get('/logout', (req, res) => {
    req.session.destroy(function(err) {
      res.redirect('/')
    })
  })

  return router;
}
