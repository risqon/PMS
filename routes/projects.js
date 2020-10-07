var express = require('express');
var router = express.Router();
const helpers = require('../helpers/util')
var moment = require('moment')
var path = require('path')

let projectOptions = {
  id: true,
  name: true,
  member: true
}

let membersOptions = {
  id: true,
  name: true,
  position: true
}

let issuesOptions = {
  id: true,
  subject: true,
  tracker: true
}

module.exports = (db) => {
  router.get('/', helpers.isLoggedIn, function (req, res, next) {
    let link = 'projects'
    let user = req.session.user
    let getData = `SELECT count(id) AS total from (SELECT DISTINCT projects.projectid as id FROM projects 
      LEFT JOIN members ON members.projectid = projects.projectid LEFT JOIN users ON users.userid = members.userid `

    // const { checkId, projectId, checkName, projectName, checkMember, projectMember } = req.query;
    let param = []
    if (req.query.checkId && req.query.projectId) {
      param.push(`projects.projectid=${req.query.projectId}`)
    }
    if (req.query.checkName && req.query.projectName) {
      param.push(`projects.name ILIKE '%${req.query.projectName}%'`)
    }
    if (req.query.checkMember && req.query.member) {
      param.push(`members.userid = ${req.query.member}`)
    }
    if (param.length > 0) {
      getData += ` WHERE ${param.join(" AND ")}`
    }

    getData += `) AS projectname`;

    //let sqlProject = `SELECT * FROM projects`
    db.query(getData, (err, totalData) => {
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

      let getData = `SELECT DISTINCT projects.projectid, projects.name, string_agg(users.firstname || ' ' || users.lastname, ', ') as member FROM projects 
      LEFT JOIN members ON members.projectid = projects.projectid LEFT JOIN users ON users.userid = members.userid `

      if (param.length > 0) {
        getData += `WHERE ${param.join(" AND ")}`
      }
      getData += `GROUP BY projects.projectid ORDER BY projectid ASC LIMIT ${limit} OFFSET ${offset}`
      db.query(getData, (err, dataProject) => {

        if (err) {
          console.log('error2:', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        let getUser = `SELECT userid, concat(firstname,' ',lastname) as fullname FROM users`
        db.query(getUser, (err, dataUsers) => {
          if (err) {
            console.log('error3:', err)
            return res.status(500).json({
              error: true,
              message: err
            })
          }
          res.render('projects/list', {
            url,
            user,
            link,
            page,
            pages,
            result: dataProject.rows,
            users: dataUsers.rows,
            user: req.session.user,
            option: projectOptions
          })

        })
      })
    })
    router.post('/option', helpers.isLoggedIn, (req, res) => {
      projectOptions.id = req.body.checkid;
      projectOptions.name = req.body.checkname;
      projectOptions.member = req.body.checkmember;
      res.redirect('/projects')
    })
  });

  router.get('/add', helpers.isLoggedIn, function (req, res, next) {
    let link = 'projects'
    let sql = `SELECT DISTINCT (userid), CONCAT(firstname, ' ', lastname) AS fullname FROM users ORDER BY fullname`
    db.query(sql, (err, data) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      res.render('projects/add', {
        link,
        data: data.rows,
        user: req.session.user
      });
    })

  });

  router.post('/add', helpers.isLoggedIn, function (req, res, next) {

    const { members, projectName } = req.body
    let sql = `INSERT INTO projects (name) values('${projectName}')`
    db.query(sql, (err) => {
      if (err) return res.send(err)

      db.query('SELECT projectid FROM projects ORDER BY projectid desc limit 1', (err, projectid) => {
        if (err) return res.send(err)

        let id = projectid.rows[0].projectid;
        let query = [];

        for (let i = 0; i < members.length; i++) {
          query.push(`(${members[i]}, ${id})`)
        }
        let sqlMembers = `INSERT INTO members (userid, projectid) values ${query.join(',')}`
        db.query(sqlMembers, (err,) => {
          res.redirect('/projects')
        })
      })
    })
  });

  router.get('/edit/:projectid', helpers.isLoggedIn, function (req, res, next) {
    const projectid = req.params.projectid
    const link = 'projects'
    const sql = `SELECT projects.name FROM projects WHERE projects.projectid = ${projectid}`
    const sqlMember = `SELECT DISTINCT (userid), CONCAT(firstname, ' ', lastname) AS fullname FROM users ORDER BY fullname`
    const sqlMembers = `SELECT members.userid, projects.name, projects.projectid FROM members LEFT JOIN projects ON members.projectid = projects.projectid  WHERE projects.projectid = ${projectid};`

    db.query(sql, (err, data) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })

      db.query(sqlMember, (err, member) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })

        db.query(sqlMembers, (err, dataMembers) => {
          if (err) return res.status(500).json({
            error: true,
            message: err
          })

          res.render('projects/edit', {
            dataMember: dataMembers.rows,
            nameProject: data.rows[0],
            members: member.rows,
            link,
            user: req.session.user
          })
        })

      })
    })
  })

  router.post('/edit/:projectid', helpers.isLoggedIn, function (req, res, next) {

    let id = req.params.projectid
    const { editName, editMembers } = req.body

    let sqlEdit = `UPDATE projects SET name = '${editName}' WHERE projectid = ${id}`
    if (id && editName && editMembers) {

      db.query(sqlEdit, (err) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })


        let memberDelete = `DELETE FROM members WHERE projectid = ${id}`
        db.query(memberDelete, (err) => {
          if (err) return res.status(500).json({
            error: true,
            message: err
          })


          let result = []
          if (typeof editMembers == 'string') {
            result.push(`(${editMembers}, ${id})`)
          } else {
            for (let i = 0; i < editMembers.length; i++) {
              result.push(`(${editMembers[i]}, ${id})`)
            }
          }

          let memberUpdate = `INSERT INTO members (userid, projectid) VALUES ${result.join(",")}`
          db.query(memberUpdate, (err) => {
            if (err) return res.status(500).json({
              error: true,
              message: err
            })

            res.redirect('/projects')
          })
        })
      })
    } else {
      res.redirect(`/projects/edit/${id}`)
    }

  });

  router.get('/delete/:projectid', helpers.isLoggedIn, function (req, res, next) {
    const id = parseInt(req.params.projectid)

    let membersData = `DELETE FROM members WHERE projectid =${id}`;
    db.query(membersData, (err) => {
      if (err) return res.send(err)

      let sqlIssues = `DELETE FROM issues WHERE projectid= ${projectid};`
      db.query(sqlIssues, (err) => {
        if (err) return res.send(err)


        let projectsData = `DELETE FROM projects WHERE projectid = ${id}`;
        db.query(projectsData, (err) => {
          if (err) return res.send(err)

          res.redirect('/projects')
        })
      })
    })
  });

  router.get('/:projectid/overview', helpers.isLoggedIn, function (req, res, next) {

    let link = 'projects'
    let url = 'overview'
    let projectid = req.params.projectid
    let sqlProject = `SELECT * FROM projects WHERE projectid = ${projectid}`

    db.query(sqlProject, (err, dataProject) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })

      let sqlMember = `SELECT users.firstname, users.lastname, members.role FROM members
      LEFT JOIN users ON members.userid = users.userid WHERE members.projectid = ${projectid}`

      db.query(sqlMember, (err, dataMamber) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })

        let sqlIssues = `SELECT tracker, status FROM issues WHERE projectid = ${projectid}`

        db.query(sqlIssues, (err, dataIssues) => {
          if (err) return res.status(500).json({
            error: true,
            message: err
          })

          let bugOpen = 0;
          let bugTotal = 0;
          let featureOpen = 0;
          let featureTotal = 0;
          let supportOpen = 0;
          let supportTotal = 0;

          dataIssues.rows.forEach(item => {
            if (item.tracker == 'Bug' && item.status !== "closed") {
              bugOpen += 1
            }
            if (item.tracker == 'Bug') {
              bugTotal += 1
            }
          })

          dataIssues.rows.forEach(item => {
            if (item.tracker == 'Feature' && item.status !== "closed") {
              featureOpen += 1
            }
            if (item.tracker == 'Feature') {
              featureTotal += 1
            }
          })

          dataIssues.rows.forEach(item => {
            if (item.tracker == 'Support' && item.status !== "closed") {
              supportOpen += 1
            }
            if (item.tracker == 'Support') {
              supportTotal += 1
            }
          })

          res.render('projects/overview/view', {
            projectid,
            link,
            url,
            data: dataProject.rows[0],
            mambers: dataMamber.rows,
            bugOpen,
            bugTotal,
            featureOpen,
            featureTotal,
            supportOpen,
            supportTotal,
            user: req.session.user
          })
        })
      })
    })
  });


  router.get('/:projectid/members', helpers.isLoggedIn, function (req, res, next) {

    let projectid = req.params.projectid
    let link = 'projects'
    let url = 'members'
    let getMember = `SELECT COUNT(member) AS total FROM(SELECT members.userid FROM members JOIN users 
      ON members.userid = users.userid WHERE members.projectid = ${projectid}`

    let result = []

    if (req.query.checkId && req.query.id) {
      result.push(`members.id = ${req.query.id}`)
    }
    if (req.query.checkName && req.query.name) {
      result.push(`CONCAT(users.firstname,' ',users.lastname) ILIKE '%${req.query.name}%'`)
    }
    if (req.query.checkPosition && req.query.position) {
      result.push(`members.role = '${req.query.position}'`)
    }
    if (result.length > 0) {
      getFilter = + ` AND ${result.join(" AND ")}`
    }

    getMember += ` ) AS member`;

    console.log(req.query.position)
    db.query(getMember, (err, totalData) => {
      if (err) {
        console.log('error1:', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      const urlpage = (req.url == `/${projectid}/members`) ? `/${projectid}/members/?page=1` : req.url;
      const page = req.query.page || 1
      const limit = 2
      const offset = (page - 1) * limit
      const total = totalData.rows[0].total
      const pages = Math.ceil(total / limit)


      let getMember = `SELECT users.userid, projects.name, projects.projectid, members.id, members.role, 
      CONCAT(users.firstname,' ',users.lastname) AS fullname FROM members
      LEFT JOIN projects ON projects.projectid = members.projectid
      LEFT JOIN users ON users.userid = members.userid WHERE members.projectid = ${projectid}`

      if (result.length > 0) {
        getMember += ` AND ${result.join(" AND ")}`
      }

      getMember += ` ORDER BY members.id ASC LIMIT ${limit} OFFSET ${offset}`

      console.log(getMember)
      db.query(getMember, (err, dataMember) => {
        if (err) {
          console.log('error2:', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }

        let getProjects = `SELECT * FROM projects WHERE projectid = ${projectid}`
        db.query(getProjects, (err, dataProjects) => {
          if (err) {
            console.log('error3:', err)
            return res.status(500).json({
              error: true,
              message: err
            })
          }
          res.render('projects/members/list', {
            link,
            url,
            pages,
            page,
            urlpage,
            projectid,
            project: dataProjects.rows[0],
            user: req.session.user,
            result: dataMember.rows,
            option: membersOptions
          })
        });
      })
    })
  })

  router.post('/:projectid/members/option', helpers.isLoggedIn, (req, res) => {
    const projectid = req.params.projectid

    membersOptions.id = req.body.checkid;
    membersOptions.name = req.body.checkname;
    membersOptions.position = req.body.checkposition;
    res.redirect(`/projects/${projectid}/members`)
  })

  router.get('/:projectid/members/add', helpers.isLoggedIn, function (req, res, next) {
    const link = 'projects';
    const url = 'members';
    const user = req.session.user;
    const projectid = req.params.projectid;

    let getData = `SELECT * FROM projects WHERE projectid = ${projectid}`
    db.query(getData, (err, dataProject) => {
      if (err) return res.send(err)

      let memberData = `SELECT userid, CONCAT(firstname,' ',lastname) As fullname FROM users
      WHERE userid NOT IN (SELECT userid FROM members WHERE projectid = ${projectid})`
      db.query(memberData, (err, dataMember) => {
        if (err) return res.send(err)

        res.render('projects/members/add', {
          link,
          url,
          user,
          projectid,
          members: dataMember.rows,
          project: dataProject.rows[0]
        })
      })
    })
  });

  router.post('/:projectid/members/add', helpers.isLoggedIn, function (req, res, next) {
    const projectid = req.params.projectid
    const { inputmember, inputposition } = req.body
    let sqlAdd = `INSERT INTO members(userid, role, projectid) VALUES ($1,$2,$3)`
    let values = [inputmember, inputposition, projectid]
    console.log(sqlAdd, values)
    db.query(sqlAdd, values, (err) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      res.redirect(`/projects/${projectid}/members`)
    })
  });

  router.get('/:projectid/members/edit/:id', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid;
    let id = req.params.id

    let sqlMember = `SELECT members.id, CONCAT(users.firstname,' ',users.lastname) AS fullname, members.role FROM members
    LEFT JOIN users ON members.userid = users.userid WHERE projectid=${projectid} AND id=${id}`

    db.query(sqlMember, (err, dataMember) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })

      let sqlProject = `SELECT * FROM projects WHERE projectid= ${projectid}`

      db.query(sqlProject, (err, dataProject) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })

        res.render('projects/members/edit', {
          projectid,
          link: 'projects',
          url: 'members',
          member: dataMember.rows[0],
          project: dataProject.rows[0],
          user: req.session.user
        })
      })
    })
  });

  router.post('/:projectid/members/edit/:id', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    let id = req.params.id;
    let position = req.body.inputposition;

    let sql = `UPDATE members SET role='${position}' WHERE id=${id}`

    db.query(sql, (err) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      res.redirect(`/projects/${projectid}/members`)
    })
  });

  router.get('/:projectid/members/delete/:id', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    let id = req.params.id;
    let sql = `DELETE FROM members WHERE projectid=${projectid} AND id=${id}`

    db.query(sql, (err) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      res.redirect(`/projects/${projectid}/members`)
    })
  })

  router.get('/:projectid/issues', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    const link = 'projects'
    const url = 'issues'
    let sqlProject = `SELECT * FROM projects WHERE projectid=${projectid}`

    let { checkId, id, checkSubject, subject, checkTracker, tracker } = req.query;
    let query = [];
    let search = ""

    if (checkId && id) {
      query.push(`issues.issueid=${id}`)
    }
    if (checkSubject && subject) {
      query.push(`issues.subject ILIKE '%${subject}%'`)
    }
    if (checkTracker && tracker) {
      query.push(`issues.tracker='${tracker}'`)
    }
    if (query.length > 0) {
      search += ` AND ${query.join(' AND ')}`
    }

    let sqlTotal = `SELECT COUNT(issueid) AS total FROM issues WHERE projectid = ${projectid} ${search}`

    db.query(sqlProject, (err, dataProject) => {
      if (err) {
        console.log('error1:', err)
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      db.query(sqlTotal, (err, totalData) => {
        if (err) {
          console.log('error2:', err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }

        let total = totalData.rows[0].total

        const urlPage = req.url == `/${projectid}/issues` ? `/${projectid}/issues/?page=1` : req.url;
        const page = req.query.page || 1
        const limit = 3;
        const offset = (page - 1) * limit;
        const pages = Math.ceil(total / limit)

        let sqlIssues = `SELECT issues.*, CONCAT(users.firstname,' ',users.lastname) AS authorname FROM issues
        LEFT JOIN users ON issues.author = users.userid WHERE issues.projectid=${projectid} ${search} 
        ORDER BY issues.issueid ASC LIMIT ${limit} OFFSET ${offset}`

        db.query(sqlIssues, (err, dataIssues) => {
          if (err) {
            console.log('error3:', err)
            return res.status(500).json({
              error: true,
              message: err
            })
          }

          let sqlAssignee = `SELECT users.userid, CONCAT(firstname,' ',lastname) AS fullname FROM members
          LEFT JOIN users ON members.userid=users.userid WHERE projectid=${projectid}`

          db.query(sqlAssignee, (err, dataAssignee) => {
            if (err) {
              console.log('error4:', err)
              return res.status(500).json({
                error: true,
                message: err
              })
            }

            res.render('projects/issues/list', {
              project: dataProject.rows[0],
              issues: dataIssues.rows,
              assignee: dataAssignee.rows,
              projectid,
              link,
              url,
              moment,
              option: issuesOptions,
              page,
              pages,
              urlPage,
              user: req.session.user
            })
          })
        })
      })
    })
  })

  router.post('/:projectid/issues/option', helpers.isLoggedIn, (req, res) => {
    const projectid = req.params.projectid

    issuesOptions.id = req.body.checkid;
    issuesOptions.subject = req.body.checksubject;
    issuesOptions.tracker = req.body.checktracker;
    res.redirect(`/projects/${projectid}/issues`)
  })

  router.get('/:projectid/issues/add', helpers.isLoggedIn, function (req, res, next) {
    const projectid = req.params.projectid
    const link = 'projects'
    const url = 'issues'

    let sqlProject = `SELECT * FROM projects WHERE projectid=${projectid}`

    db.query(sqlProject, (err, dataProject) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      let project = dataProject.rows[0]

      let sqlMembers = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) AS fullname FROM members
      LEFT JOIN users ON members.userid = users.userid WHERE projectid=${projectid}`

      db.query(sqlMembers, (err, dataMembers) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })
        let members = dataMembers.rows

        res.render('projects/issues/add', {
          projectid,
          link,
          url,
          project,
          members,
          user: req.session.user
        })
      })
    })
  });

  router.post('/:projectid/issues/add', helpers.isLoggedIn, function (req, res, next) {
    let projectid = parseInt(req.params.projectid)
    const { tracker, subject, description, status, priority, assignee, startDate, dueDate, estimatedTime, done } = req.body
    let user = req.session.user

    if (req.files) {
      let file = req.files.file
      let fileName = file.name.toLowerCase().replace('', Date.now()).split(' ').join('-')
      let addData = `INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, done, author, createddate)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`
      let values = [projectid, tracker, subject, description, status, priority, assignee, startDate, dueDate, Number(estimatedTime), done, user.userid]

      db.query(addData, values, (err) => {
        if (err) {
          console.log('error1', err)
          return res.send(err)
        }
        file.mv(path.join(__dirname, '..', 'public', 'upload', fileName), function (err) {
          if (err) return res.send(err)

          res.redirect(`/projects/${projectid}/issues`)
        })
      })
    } else {
      let addData = `INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, done, author, createddate)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`
      let values = [projectid, tracker, subject, description, status, priority, assignee, startDate, dueDate, Number(estimatedTime), done, user.userid]

      db.query(addData, values, (err) => {
        if (err) {
          console.log('error1', err)
          return res.send(err)
        }
        res.redirect(`/projects/${projectid}/issues`)
      })
    }
  })

  router.get('/:projectid/issues/delete/:issueid', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    let id = req.params.issueid;
    let sql = `DELETE FROM issues WHERE projectid=${projectid} AND issueid=${id}`

    db.query(sql, (err) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })
      res.redirect(`/projects/${projectid}/issues`)
    })
  })

  router.get('/:projectid/issues/edit/:issueid', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    let issueId = req.params.issueid
    const link = 'projects';
    const url = 'issues';

    let sqlProject = `SELECT * FROM projects WHERE projectid= ${projectid}`
    db.query(sqlProject, (err, dataProject) => {
      if (err) {
        console.log('error1')
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      let sqlIssues = `SELECT issues.*, CONCAT(users.firstname,' ',users.lastname) AS authorname FROM issues
      LEFT JOIN users ON issues.author = users.userid WHERE projectid=${projectid} AND issueid=${issueId}`

      db.query(sqlIssues, (err, dataIssues) => {
        if (err) {
          console.log('error2')
          return res.status(500).json({
            error: true,
            message: err
          })
        }

        let sqlMember = `SELECT users.userid, CONCAT(users.firstname,' ',users.lastname) AS fullname FROM members
        LEFT JOIN users ON members.userid = users.userid WHERE projectid=${projectid}`
        db.query(sqlMember, (err, dataMember) => {
          if (err) {
            console.log('error3')
            return res.status(500).json({
              error: true,
              message: err
            })
          }

          let sql = `SELECT issueid, subject, tracker FROM issues WHERE projectid =${projectid}`
          db.query(sql, (err, data) => {
            if (err) {
              console.log('error4')
              return res.status(500).json({
                error: true,
                message: err
              })
            }

            res.render('projects/issues/edit', {
              user: req.session.user,
              link,
              url,
              moment,
              projectid,
              project: dataProject.rows[0],
              issue: dataIssues.rows[0],
              members: dataMember.rows,
              dataIs: data.rows
            });
          });
        })
      })
    })
  })

  router.post('/:projectid/issues/edit/:issueid', helpers.isLoggedIn, function (req, res, next) {
    const projectid = req.params.projectid;
    const issueid = req.params.issueid;
    const query = req.body;
    const user = req.session.user;

    let title = `${query.subject} #${issueid} (${query.tracker}) - [${query.status}]`
    let desc = `Spent Time by Hours : from ${query.oldspent} updated to ${query.spenttime}`
    let dataActivity = `INSERT INTO activity (time, title, description, author, projectid, olddone, nowdone) VALUES (NOW(), $1, $2, $3, $4, $5, $6)`
    let value = [title, desc, user.userid, projectid, query.olddone, query.done]


    if (req.files) {
      let file = req.files.file;
      let fileName = file.name.toLowerCase().replace("", Date.now()).split(" ").join("-");

      let dataUpdate = `UPDATE issues SET subject = $1, description = $2, status = $3, priority = $4, assignee = $5, duedate = $6, done = $7, parenttask = $8, 
      spenttime = $9, targetversion = $10, files = $11, updateddate = $12 ${query.status == 'closed' ? `, closeddate = NOW() ` : " "}WHERE issueid = $13`

      let values = [query.subject, query.description, query.status, query.priority, parseInt(query.assignee),
      query.dueDate, parseInt(query.done), query.parenttask, parseInt(query.spenttime), query.target, fileName, 'NOW()', issueid]

      db.query(dataUpdate, values, (err) => {
        if (err) {
          console.log('error1')
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        file.mv(path.join(__dirname, '..', 'public', 'upload', fileName), function (err) {
          if (err) {
            console.log('error2')
            return res.status(500).json({
              error: true,
              message: err
            })
          }
          console.log(dataActivity)
          console.log(value)
          db.query(dataActivity, value, (err) => {
            if (err) {
              console.log('error3')
              return res.status(500).json({
                error: true,
                message: err
              })
            }

            res.redirect(`/projects/${projectid}/issues`)
          })
        })
      })
    } else {

      let updateData = `UPDATE issues SET subject = $1, description = $2, status = $3, priority = $4, assignee = $5, duedate = $6, done = $7, parenttask = $8, 
      spenttime = $9, targetversion = $10, updateddate = $11 ${query.status == 'closed' ? `, closeddate = NOW() ` : " "}WHERE issueid = $12`

      let values = [query.subject, query.description, query.status, query.priority, parseInt(query.assignee),
      query.dueDate, parseInt(query.done), query.parenttask, parseInt(query.spenttime), query.target, 'NOW()', issueid]

      db.query(updateData, values, (err) => {
        if (err) {
          console.log('error4')
          return res.status(500).json({
            error: true,
            message: err
          })
        }
        db.query(dataActivity, value, (err) => {
          if (err) {
            console.log('error5')
            return res.status(500).json({
              error: true,
              message: err
            })
          }

          res.redirect(`/projects/${projectid}/issues`)
        })
      })
    }
  });

  router.get('/:projectid/activity', helpers.isLoggedIn, function (req, res, next) {
    let projectid = req.params.projectid
    let link = 'projects'
    let url = 'activity'

    let projectData = `SELECT * FROM projects WHERE projectid = ${projectid}`
    db.query(projectData, (err, dataProject) => {
      if (err) {
        console.log('error1')
        return res.status(500).json({
          error: true,
          message: err
        })
      }

      let sqlActivity = `SELECT activity.*, CONCAT(users.firstname,' ',users.lastname) AS authorname, 
      (time AT TIME ZONE 'Asia/Jakarta'):: time AS timeactivity,
      (time AT TIME ZONE 'Asia/Jakarta'):: date AS dateactivity
      FROM activity LEFT JOIN users ON activity.author = users.userid WHERE projectid=${projectid}
      ORDER BY dateactivity DESC, timeactivity DESC`
      
      db.query(sqlActivity, (err, dataActivity) => {
        if (err) {
          console.log('error2',err)
          return res.status(500).json({
            error: true,
            message: err
          })
        }

        let activity = dataActivity.rows
       console.log(activity)
        activity.forEach(item => {
          item.dateactivity = moment(item.dateactivity).format('YYYY-MM-DD');
          item.timeactivity = moment(item.timeactivity, 'HH:mm:ss.SS').format('HH:mm:ss');

          if (item.dateactivity == moment().format('YYYY-MM-DD')) {
            item.dateactivity = 'Today'
          } else if (item.datectivity == moment().subtract(1, 'daya').format('YYYY-MM-DD')) {
            item.datectivity = 'Yesterday'
          } else {
            item.datectivity = moment(item.datectivity).format("MMMM Do, YYYY")
          }
        })
        
        res.render('projects/activity/view', {
          user: req.session.user,
          url,
          link,
          moment,
          activity,
          projectid,
          project: dataProject.rows[0]
        });
      });
    })
  })
  return router;
}

