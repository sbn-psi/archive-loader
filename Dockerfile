FROM node:22 AS build

WORKDIR /usr/src/archive-loader

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:frontend

FROM node:22 AS runtime

WORKDIR /usr/src/archive-loader

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY .env.example ./
COPY LICENSE ./
COPY README.md ./
COPY --from=build /usr/src/archive-loader/frontend/dist ./frontend/dist

EXPOSE 8989

CMD [ "npm", "start" ]
