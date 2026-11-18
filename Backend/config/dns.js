const dns = require('node:dns/promises');

function configureDns() {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

module.exports = configureDns;
