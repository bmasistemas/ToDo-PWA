// process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || 'http://rafaelg:fgh%21%23@192.168.2.1:8080/'

var express = require('express')
var bodyParser = require('body-parser')
var app = express()
var morgan = require('morgan')
var http = require('http')
var https = require('https')
var fs = require('fs')
var Sequelize = require('sequelize')

var options = {
  pfx: fs.readFileSync('./iis-cert.pfx'),
  passphrase: 'qwerty'
}

var sequelize = new Sequelize('mysql://root:bma@localhost/test')

var Tasks = sequelize.define('tasks', {
  id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
  text: { type: Sequelize.STRING, allowNull: false },
  done: { type: Sequelize.BOOLEAN, defaultValue: false },
  hide: { type: Sequelize.BOOLEAN, defaultValue: false },
  lastUpdate: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
}, {
    timestamps: false
})

app.use(morgan('dev'))

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

var httpPort = process.env.PORT || 8080
var httpsPort = 8443

var router = express.Router()

router.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
	next()
})

router.get('/', function (req, res) {
  sequelize
    .authenticate()
    .then(function (err) {
      res.json({ alive: true })
    })
    .catch(function (err) {
      console.error('Unable to connect to the database:', err)
      res.json({ alive: false })
    })
})

router.route('/tasks')
	.post(function (req, res) {
    var task = req.body.task
    task.lastUpdate = new Date()
    Tasks.create(task).then(function (data) {
      // console.log('post', { task: data })
      res.json({ alive: true, task: data.dataValues })
    })
	})
	.get(function (req, res) {
    Tasks.all().then(function(tasks) {
      res.json({ alive: true, tasks: tasks })
    })
	})
  .put(function (req, res) {
    var task = req.body.task
    task.lastUpdate = new Date()
    Tasks.update(task, { where: { id: task.id } }).then(function (data) {
      // console.log('put', { task: task })
      res.json({ alive: true, task: task })
    })
	})

app.use('/api', router)

var httpServer = http.createServer(app)
var httpsServer = https.createServer(options, app)

httpServer.listen(httpPort)
httpsServer.listen(httpsPort)

console.log('Listening on port ' + httpPort + ' and ' + httpsPort)