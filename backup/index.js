const fs = require('fs')
const rmRf = require('rimraf')
const Git = require('nodegit')
const request = require('request')

const INTERVAL = 1000 * 60 * 60 * 12 // backup every 12 hours
const DIR = 'repo'
const FILE = 'export.json'

// env setup
if(!process.env.GITHUB_URL) {
    console.log('using local github.env file')
    require('dotenv').config({ path: 'github.env' })
}

const {
    GITHUB_URL: remoteRepo,
    GIT_NAME: gitName,
    GIT_EMAIL: gitEmail,
    GITHUB_USER: githubUser,
    GITHUB_PASS: githubPass
} = process.env
const archiveloader = process.env.NODE_ENV === 'production' ? 'http://archiveloader:8989/' : 'http://localhost:8989/'

var repository
rmRf(DIR, bootstrap)
async function bootstrap() {
    repository = await Git.Clone(remoteRepo, `./${DIR}`)
    mainLoop()
}

async function mainLoop() {
    console.log('Pulling export')
    request.get(`${archiveloader}export/all`)
        .on('error', (err) => {
            console.log(err.message)
        })
        .pipe(fs.createWriteStream(`./${DIR}/${FILE}`))
        .on('finish', commit)
}
    
    
async function commit() {
    let statuses = await repository.getStatus()
    let modified = false
    statuses.forEach(status => {
        if(status.isModified) { modified = true }
    })
    if(modified === true) {
        let index = await repository.refreshIndex()
        await index.addByPath(FILE)
        await index.write()
        let oid = await index.writeTree()
        let head = await Git.Reference.nameToId(repository, "HEAD")
        let parent = await repository.getCommit(head)
    
        let author = Git.Signature.now(gitName,gitEmail)
        let committer = Git.Signature.now(gitName,gitEmail)
        let date = new Date().toLocaleString()
    
        await repository.createCommit("HEAD", author, committer, date, oid, [parent])
    
        let remote = await Git.Remote.lookup(repository, "origin")
        await remote.push(["refs/heads/master:refs/heads/master"], {
            callbacks: { credentials: () => Git.Cred.userpassPlaintextNew(githubUser, githubPass) }
        })
    
        console.log(`Committed changes at ${date}`)
    }

    setTimeout(mainLoop, INTERVAL)            
}
