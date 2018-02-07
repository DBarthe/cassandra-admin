FROM node:carbon

ENV PORT 8080
EXPOSE 8080

WORKDIR /usr/bin/app

COPY package*.json ./

RUN npm install

COPY dist ./dist

CMD node dist