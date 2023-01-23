FROM node:16

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY src .

RUN npm run build
