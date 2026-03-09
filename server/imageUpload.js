const crypto = require('crypto')
const multer = require('multer')
const path = require('path')
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3')
const { config } = require('./config.js')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 3 * 1024 * 1024
    }
})

const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey
    }
})

function buildObjectKey(filename) {
    const safeExtension = path.extname(filename || '').toLowerCase()
    const extension = safeExtension && safeExtension.length <= 10 ? safeExtension : ''
    const base = crypto.randomUUID()
    return config.imageUploads.prefix ? `${config.imageUploads.prefix}/${base}${extension}` : `${base}${extension}`
}

function buildImageUrl(key) {
    if (config.imageUploads.baseUrl) {
        return `${config.imageUploads.baseUrl.replace(/\/+$/, '')}/${key}`
    }
    return `https://${config.imageUploads.bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`
}

const middleware = [
    upload.single('file'),
    async function imageUploadHandler(req, res) {
        if (!req.file) {
            res.status(400).json({ error: 'Expected image file upload' })
            return
        }

        try {
            const key = buildObjectKey(req.file.originalname)
            await s3.send(new PutObjectCommand({
                Bucket: config.imageUploads.bucket,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype
            }))
            res.status(200).json({ url: buildImageUrl(key) })
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: 'Image upload failed' })
        }
    }
]

module.exports = middleware
