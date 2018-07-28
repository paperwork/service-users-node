FROM paperworkco/paperplane-node:latest

# add ContainerPilot configuration
COPY containerpilot.json5 /etc/containerpilot.json5
COPY containerpilot.sh /usr/local/bin/
RUN chmod 500 /usr/local/bin/containerpilot.sh

########### Service related ###########

WORKDIR /app
COPY . .

RUN npm install \
 && npm run compile \
 && rm -rf node_modules \
 && npm install --production \
 && apk del python2 make

RUN apk del curl make gcc g++ python linux-headers binutils-gold gnupg ${DEL_PKGS} && \
  rm -rf ${RM_DIRS} /node-${VERSION}* /usr/share/man /tmp/* /var/cache/apk/* \
    /root/.npm /root/.node-gyp /root/.gnupg /usr/lib/node_modules/npm/man \
    /usr/lib/node_modules/npm/doc /usr/lib/node_modules/npm/html /usr/lib/node_modules/npm/scripts

EXPOSE 3000

ENTRYPOINT []
CMD ["containerpilot"]
