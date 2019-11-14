// internal modules
require('../static/scripts/helpers.js')
const db = require('./db.js')

// env setup
if(!process.env.MINIO_ACCESS_KEY) {
    console.log('using local services.env file')
    require('dotenv').config({ path: 'services.env' })
}

// express, minio setup
console.log('connecting to file server...')
require('./minio.js').bootstrap().then(expressSetup, console.log)
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json())
const helmet = require('helmet')
app.use(helmet())

// called once file server is bootstrapped; starts the actual listening process
function expressSetup(minioHandler) {
    app.use('/image/upload', minioHandler)
    app.listen(8989, () => {
        console.log('running on port 8989...')
    })
}

// // // AUTH MANAGEMENT // // // 
const adminUser = 'admin'
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
passport.use('local', new LocalStrategy(
    function(username, password, done) {
        if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) { return done(null, adminUser)}
        else return done(null, false, { message: 'Invalid password'})
    }
))
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    done(null, user)
})
  
// // // COOKIE MANAGEMENT // // //
const session = require('express-session')
const MongoStore = require('connect-mongo')(session);
app.use(session({
    name: 'archive-loader',
    secret: process.env.AUTH_SECRET,
    maxAge: 604800000,
    store: new MongoStore({clientPromise: db.client}),
    resave: false,
    saveUninitialized: false,
    rolling: true,
}))
    
app.use(passport.initialize())
app.use(passport.session())

app.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }))
app.use(express.static('static'))

// // // SECURE ROUTES // // //
app.all('*', (req, res, next) => req.isAuthenticated() ? next() : res.sendStatus(403))
app.use('/relationship-types', require('./routes/relationship-types'))
app.use('/export', require('./routes/export'))
app.use('/tags', require('./routes/tags'))
app.use('/status', require('./routes/status'))
app.use('/related', require('./routes/related'))
app.use('/lookup', require('./routes/lookup'))
app.use('/edit', require('./routes/edit'))
app.use('/datasets/check', require('./routes/edit'))
app.use('/save', require('./routes/save-dataset'))
app.use('/save', require('./routes/save-context-object'))
app.use('/save', require('./routes/save-relationships'))
app.use('/solr', require('./routes/solr'))