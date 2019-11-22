FROM node:8

WORKDIR /usr/src/backup-service

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy project to docker container
COPY . .

# Start container process that will keep container up and running
CMD [ "npm", "start" ]