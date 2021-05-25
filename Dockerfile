FROM node:16

WORKDIR /usr/src/archive-loader

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy project to docker container
COPY . .

# Expose port to outside world
EXPOSE 8989

# Start container process that will keep container up and running
CMD [ "npm", "start" ]