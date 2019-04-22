#       Copyright 2018 IBM Corp All Rights Reserved

#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at

#       http://www.apache.org/licenses/LICENSE-2.0

#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

FROM node:8.9-alpine
#FROM ubuntu:latest
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
RUN apk update && apk upgrade && apk add --no-cache git && apk add --no-cache libc6-compat
#RUN apt-get update && apt-get install -y nodejs && apt-get install -y npm 

COPY . /usr/src/app/
#RUN npm install ./ibmapm
RUN npm install --no-optional
RUN npm run build

ENV LD_LIBRARY_PATH /usr/src/app/node_modules/appmetrics
ENV HOST 0.0.0.0
EXPOSE 3000

# start command
CMD [ "node", "./bin/www" ]
