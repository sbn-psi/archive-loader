// internal modules
require('../static/scripts/helpers.js')
const db = require('./db.js')
const {streamList, standardChunk} = require('./utils.js')

// Import required modules
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

// Function to upload the generated file to S3
async function uploadToS3(filePath, bucketName, key) {
    const fileContent = fs.readFileSync(filePath);  // Read file content

    // S3 upload parameters
    const params = {
        Bucket: bucketName,
        Key: key, 
        Body: fileContent,
        ContentType: 'application/json',
    };

    try {
        const result = await s3.upload(params).promise();
        console.log("File uploaded successfully:", result.Location);
    } catch (err) {
        console.error("Error uploading file:", err);
    }
}

// Function to generate and upload the file
async function generateAndUploadFile() {
    const filePath = path.join(__dirname, 'databaseExport.json');  
    const writeStream = fs.createWriteStream(filePath);

    writeStream.write('{');

    let databases = [db.datasets, db.targets, db.missions, db.spacecraft, db.instruments, db.targetRelationships, db.targetMissionRelationshipTypes, db.instrumentSpacecraftRelationshipTypes, db.tags, db.objectRelationships, db.tools];
    let index = 0;

    for (let database of databases) {
        writeStream.write(`"${database}": `);

        let listStreamer = streamList(writeStream, standardChunk);
        await db.findAndStream({}, database, listStreamer.data, listStreamer.end);

        index++;
        if (index < databases.length) {
            writeStream.write(',');
        }
    }

    writeStream.end('}');  // End the JSON object

    // Wait until the file is fully written and then upload it to S3
    writeStream.on('finish', async () => {
        try {
            const bucketName = 'pds-sbn-psi-archiveloader-backup';
            const s3Key = `backup-${process.env.APP_ENVIRONMENT ? process.env.APP_ENVIRONMENT : 'unknown'}-${new Date().toISOString()}.json`;  // Unique key for the backup file
            await uploadToS3(filePath, bucketName, s3Key);

            fs.unlinkSync(filePath);
        } catch (error) {
            console.error('Error generating or uploading file:', error);
        }
    });

    writeStream.on('error', (err) => {
        console.error('Error writing to file:', err);
    });
}

// the singleton that manages the backup process
class BackupManager {
  constructor() {
    if (!BackupManager.instance) {
      this.lastBackupTime = null;  // Store the last backup time
      this.isDirty = true;        // Track if the backup is dirty (needs to be uploaded), default to true so that the first backup is uploaded immediately
      BackupManager.instance = this;
      db.setBackupManager(this);  // Set the backup manager in the database module
    }

    return BackupManager.instance;
  }

  // Mark the backup as "dirty", meaning it needs to be uploaded
  markAsDirty() {
    this.isDirty = true;
    console.log('Backup marked as dirty. Will upload on next interval.');
  }

  async uploadBackup() {
    console.log('Uploading backup...');
    await generateAndUploadFile();
    console.log('Backup uploaded!');
    this.lastBackupTime = new Date();
    this.isDirty = false;
  }

  // Perform the backup process
  async performBackup() {
    if (this.isDirty) {
      await this.uploadBackup();
    } else {
      console.log('Backup is up-to-date. No need to upload.');
    }
  }
}

const instance = new BackupManager();

module.exports = instance;