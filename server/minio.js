module.exports = {
    bootstrap
}
const minioExpress = require('express-middleware-minio')
const middleware = minioExpress.middleware()
const Minio = require('minio')

let readPolicy = (bucket, directory) => `{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "*"
                ]
            },
            "Action": [
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::${bucket}"
            ]
        },
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "*"
                ]
            },
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::${bucket}"
            ],
            "Condition": {
                "StringEquals": {
                    "s3:prefix": [
                        "${directory}"
                    ]
                }
            }
        },
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "*"
                ]
            },
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::${bucket}/${directory}*"
            ]
        }
    ]
}`

async function bootstrap() {
    const bucket = process.env.MINIO_BUCKET
    let config = {
        endPoint: process.env.MINIO_ENDPOINT,
        port: parseInt(process.env.MINIO_PORT),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY
    }
    if(!!process.env.MINIO_PORT) {
        config.port = parseInt(process.env.MINIO_PORT)
    }
    let minioClient = new Minio.Client(config)

    return new Promise((resolve, reject) => {
        let setPolicy = () => {
            let policy = readPolicy(bucket, process.env.MINIO_UPLOADS_FOLDER_NAME)
            minioClient.setBucketPolicy(process.env.MINIO_BUCKET, policy, (err) => {
                err ? reject(err) : resolve(uploadHandler)
            })
        }
        minioClient.bucketExists(bucket, function(err, exists) {
            if(err) {
                reject(err)
                return
            }

            if(!exists) {
                console.log(`bucket ${bucket} didn't exist, creating`)
                minioClient.makeBucket(bucket).then(setPolicy, reject)
            } else setPolicy()
            
        })
    })
}

function uploadHandler(req, res) {
    let imageBaseUrl = `http://${process.env.MINIO_ENDPOINT}${process.env.MINIO_PORT ? ':' + process.env.MINIO_PORT : ''}/${process.env.MINIO_BUCKET}/${process.env.MINIO_UPLOADS_FOLDER_NAME}/`
    middleware({op: minioExpress.Ops.post})(req, res, () => {
        if (req.minio.error) {
            res.status(400).json({ error: req.minio.error })
        } else {
            res.send({ url: imageBaseUrl + req.minio.post.filename })
        }
    })
}