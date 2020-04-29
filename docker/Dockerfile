FROM node:erbium
WORKDIR /app
COPY ./src ./src
COPY ./gulpfile.js ./
COPY ./tsconfig.json ./
COPY ./package.json ./
RUN npm install
CMD npm start