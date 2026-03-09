// internal modules
require('../static/scripts/helpers.js')
const db = require('./db.js')
const backupManager = require('./backupManager.js')
const fs = require('fs')
const path = require('path')
const { config, missingRequiredEnv } = require('./config.js')
const imageUpload = require('./imageUpload.js')

const missingEnv = missingRequiredEnv()
if (missingEnv.length > 0) {
    console.warn(`Missing environment variables: ${missingEnv.join(', ')}`)
}

const express = require('express')
const app = express()
app.use(express.json({ limit: '10mb' }))
const helmet = require('helmet')
app.use(helmet())
startServer()

function startServer() {
    app.listen(config.port, () => {
        console.log(`running on port ${config.port}...`)
    })

    // backup every 24 hours
    setInterval(async () => {
        await backupManager.performBackup();
    }, 24 * 60 * 60 * 1000);
}

// // // AUTH MANAGEMENT // // // 
const adminUser = 'Admin'
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
passport.use('local', new LocalStrategy(
    async function(username, password, done) {
        if(username === config.adminUser && password === config.adminPass) { return done(null, adminUser)}
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
    secret: config.authSecret,
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
const reactDist = path.resolve(__dirname, '../frontend/dist')
if (fs.existsSync(reactDist)) {
    const apiMatchers = [
        (requestPath) => requestPath === '/export' || requestPath.startsWith('/export/'),
        (requestPath) => requestPath === '/login',
        (requestPath) => requestPath === '/logout',
        (requestPath) => requestPath === '/user',
        (requestPath) => requestPath === '/relationship-types' || requestPath.startsWith('/relationship-types/'),
        (requestPath) => requestPath === '/tags' || requestPath.startsWith('/tags/'),
        (requestPath) => requestPath === '/status' || requestPath.startsWith('/status/'),
        (requestPath) => requestPath === '/related' || requestPath.startsWith('/related/'),
        (requestPath) => requestPath === '/lookup' || requestPath.startsWith('/lookup/'),
        (requestPath) => requestPath === '/edit' || requestPath.startsWith('/edit/'),
        (requestPath) => requestPath === '/delete' || requestPath.startsWith('/delete/'),
        (requestPath) => requestPath === '/image' || requestPath.startsWith('/image/'),
        (requestPath) => requestPath === '/datasets/harvest' || requestPath.startsWith('/datasets/check/'),
        (requestPath) => requestPath === '/save' || requestPath.startsWith('/save/'),
        (requestPath) => requestPath === '/solr' || requestPath.startsWith('/solr/'),
        (requestPath) => requestPath === '/import' || requestPath.startsWith('/import/'),
        (requestPath) => requestPath === '/admin' || requestPath.startsWith('/admin/'),
    ]
    const isFrontendRequest = (req) => req.method === 'GET' && !apiMatchers.some((matches) => matches(req.path))

    app.use(express.static(reactDist))
    app.get('/app', (req, res) => {
        res.redirect(301, '/')
    })
    app.get('/app/*', (req, res) => {
        res.redirect(301, req.path.replace(/^\/app/, '') || '/')
    })
    app.get('*', (req, res, next) => {
        if (!isFrontendRequest(req)) {
            return next()
        }
        res.sendFile(path.join(reactDist, 'index.html'))
    })
}

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
app.use('/image/upload', imageUpload)
app.use('/datasets', require('./routes/dataset-check'))
app.use('/save', require('./routes/save-dataset'))
app.use('/save', require('./routes/save-context-object'))
app.use('/save', require('./routes/save-relationships'))
app.use('/save', require('./routes/save-tags'))
app.use('/solr', require('./routes/solr'))
app.use('/import', require('./routes/import'))

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
app.get('/admin/backup', async function(req, res) {
    try {
        await backupManager.uploadBackup();
        res.status(200).send("Backup uploaded successfully");
    } catch (error) {
        console.log('Error uploading backup:', error);
        res.status(500).send("Failed to upload backup");
    }
})
