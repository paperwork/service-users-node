Paperwork Users Service
=======================

[![Build Status](https://travis-ci.org/paperworkco/service-users.svg)](https://travis-ci.org/paperworkco/service-users)

### Development

(Optional) Using a local version of Paperframe:

```bash
$ git clone git@github.com:paperworkco/paperframe.git
$ cd paperframe
$ npm link
```

Cloning the repository:

```bash
$ git clone git@github.com:twostairs/paperwork.git
$ cd paperwork
$ cd service-users/
```

(Optional) Linking local version of Paperframe:

```bash
$ npm link paperframe
```

Preparing:

```bash
$ npm install
$ cp .env.example .env
$ vim .env
$ # adjust the settings accordingly
```

Starting in development mode (with code auto-reload):

```bash
$ npm run dev
```

Running tests:

```bash
$ cd service-users/
$ npm test
```

TODO: Write tests.

#### API documentation

[Here](documentation/API.md).

### Docker

```bash
$ cd service-users/
$ docker build -t="paperwork/service-users" .
$ docker run -it --rm --name="paperwork-service-users" --env-file .env paperwork/service-users
```

