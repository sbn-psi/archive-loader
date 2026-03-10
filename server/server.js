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
app.post('/api/login', passport.authenticate('local'), (req, res) => {
    res.status(200).send({user: req.user})
})
app.use('/api/export', require('./routes/export'))
const reactDist = path.resolve(__dirname, '../frontend/dist')
if (fs.existsSync(reactDist)) {
    const apiMatchers = [
        (requestPath) => requestPath === '/api' || requestPath.startsWith('/api/'),
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
app.all('/api/*', (req, res, next) => req.isAuthenticated() ? next() : res.sendStatus(403))
app.get('/api/logout', (req, res) => {
    req.logout(err => {
        if(err) {
            console.log(err)
            res.sendStatus(500)
        }
        else res.sendStatus(204)
    })
})
app.get('/api/user', (req, res) => {
    res.status(200).send({user: req.user})
})
app.use('/api/relationship-types', require('./routes/relationship-types'))
app.use('/api/tags', require('./routes/tags'))
app.use('/api/status', require('./routes/status'))
app.use('/api/related', require('./routes/related'))
app.use('/api/lookup', require('./routes/lookup'))
app.use('/api/edit', require('./routes/edit'))
app.use('/api/delete', require('./routes/delete'))
app.use('/api/image/upload', imageUpload)
app.use('/api/datasets', require('./routes/dataset-check'))
app.use('/api/save', require('./routes/save-dataset'))
app.use('/api/save', require('./routes/save-context-object'))
app.use('/api/save', require('./routes/save-relationships'))
app.use('/api/save', require('./routes/save-tags'))
app.use('/api/solr', require('./routes/solr'))
app.use('/api/import', require('./routes/import'))

// // // SUPER SECURE ROUTES // // //
app.all('/api/admin/*', (req, res, next) => req.user === adminUser ? next() : res.sendStatus(403))
app.post('/api/admin/create-user', async function(req, res) {
    const { username, password } = req.body
    const hash = await bcrypt.hash(password, 10)
    db.insert([{ username, password: hash }], db.users)
    res.sendStatus(201)
})
app.get('/api/admin/permission', async function(req, res) {
    res.status(200).send("Yep you're an admin")
})
app.get('/api/admin/backup', async function(req, res) {
    try {
        await backupManager.uploadBackup();
        res.status(200).send("Backup uploaded successfully");
    } catch (error) {
        console.log('Error uploading backup:', error);
        res.status(500).send("Failed to upload backup");
    }
})
