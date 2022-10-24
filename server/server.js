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
require('./minio.js').bootstrap().then(expressSetup, error => {
    console.log("############# ERROR #################")
    console.log("##### Couldn't connect to Minio #####")
    console.log(error)
    console.log("###### Starting server anyway #######")
    startServer()
});
const express = require('express')
const app = express()
app.use(express.json({ limit: '3MB' }))
const helmet = require('helmet')
app.use(helmet())

// called once file server is bootstrapped; starts the actual listening process
function expressSetup(minioHandler) {
    app.use('/image/upload', minioHandler)
    startServer()
}

function startServer() {
    app.listen(8989, () => {
        console.log('running on port 8989...')
    })
}

// // // AUTH MANAGEMENT // // // 
const adminUser = 'Admin'
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
passport.use('local', new LocalStrategy(
    async function(username, password, done) {
        if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) { return done(null, adminUser)}
        else {
            let user = await db.find({username}, db.users)
            if(!!user && user.length > 0) {
                user = user[0]
                const match = await bcrypt.compare(password, user.password)
                if(match) {
                    return done(null, user.username)
                }
                else {
                    return done(null, false, { message: 'Invalid login'})   
                }
            }
            else return done(null, false, { message: 'Invalid login'})
        }

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
app.set('trust proxy', 1)
app.use(session({
    name: 'archive-loader',
    secret: process.env.AUTH_SECRET,
    maxAge: 604800000,
    store: new MongoStore({clientPromise: db.client}),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: false
    }
}))
    
app.use(passport.initialize())
app.use(passport.session())

// // // PUBLIC ROUTES // // //
app.post('/login', passport.authenticate('local'), (req, res) => {
    res.status(200).send({user: req.user})
})
app.use('/export', require('./routes/export'))
app.use(express.static('static'))

// // // SECURE ROUTES // // //
app.all('*', (req, res, next) => req.isAuthenticated() ? next() : res.sendStatus(403))
app.get('/logout', (req, res) => {
    req.logout(err => {
        if(err) {
            console.log(err)
            res.sendStatus(500)
        }
        else res.sendStatus(204)
    })
})
app.get('/user', (req, res) => {
    res.status(200).send({user: req.user})
})
app.use('/relationship-types', require('./routes/relationship-types'))
app.use('/tags', require('./routes/tags'))
app.use('/status', require('./routes/status'))
app.use('/related', require('./routes/related'))
app.use('/lookup', require('./routes/lookup'))
app.use('/edit', require('./routes/edit'))
app.use('/delete', require('./routes/delete'))
app.use('/datasets/check', require('./routes/dataset-check'))
app.use('/save', require('./routes/save-dataset'))
app.use('/save', require('./routes/save-context-object'))
app.use('/save', require('./routes/save-relationships'))
app.use('/save', require('./routes/save-tags'))
app.use('/solr', require('./routes/solr'))

// // // SUPER SECURE ROUTES // // //
app.all('/admin/*', (req, res, next) => req.user === adminUser ? next() : res.sendStatus(403))
app.post('/admin/create-user', async function(req, res) {
    const { username, password } = req.body
    const hash = await bcrypt.hash(password, 10)
    db.insert([{ username, password: hash }], db.users)
    res.sendStatus(201)
})
app.get('/admin/permission', async function(req, res) {
    res.status(200).send("Yep you're an admin")
})