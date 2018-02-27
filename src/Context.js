const getos = require('./config/getos');

const getSystemContext = (dist = '') => {
  if (/ubuntu/i.test(dist)) {
    return {
      system: 'ubuntu',
      username: 'debian-tor',
    };
  }
  if (/debian/i.test(dist)) {
    return {
      system: 'debian',
      username: 'debian-tor',
    };
  }
  if (/fedora/i.test(dist)) {
    return {
      system: 'fedora',
      username: 'toranon',
    };
  }
  if (/arch/i.test(dist)) {
    return {
      system: 'arch',
      username: 'tor',
    };
  }
  return {
    system: 'unknown',
    username: 'tor',
  };
};

class Context {
  constructor(systemInfo) {
    if (systemInfo.os !== 'linux') throw new Error(`Unsupported operational system ${systemInfo.os}`);
    const { system, username } = getSystemContext(systemInfo.dist);

    this.system = system;
    this.username = username;
  }

  static async build() {
    const systemInfo = await getos();
    return new Context(systemInfo);
  }
}

module.exports = Context;
