const http = require('http');
const execa = require('execa');
const Context = require('./Context');

const request = url => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    res.setEncoding('utf8');
    const { statusCode } = res;

    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    }).on('end', () => {
      resolve({ statusCode, body });
    });
  }).on('error', reject);
});

class Nipe {
  constructor(options = {
    dnsPort: '9061',
    transferPort: '9051',
    tables: ['nat', 'filter'],
    network: '10.66.0.0/255.255.0.0',
  }) {
    this.dnsPort = options.dnsPort;
    this.transferPort = options.transferPort;
    this.tables = options.tables;
    this.network = options.network;
    this.running = false;
  }

  async _configure(table) {
    let target = 'ACCEPT';
    if (table === 'nat') target = 'RETURN';

    await execa.shell(`sudo iptables -t ${table} -F OUTPUT`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -m state --state ESTABLISHED -j ${target}`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -m owner --uid ${this.context.username} -j ${target}`);

    let matchDnsPort = this.dnsPort;
    if (table === 'nat') {
      target = `REDIRECT --to-ports ${this.dnsPort}`;
      matchDnsPort = '53';
    }

    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -p udp --dport ${matchDnsPort} -j ${target}`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -p tcp --dport ${matchDnsPort} -j ${target}`);

    if (table === 'nat') target = `REDIRECT --to-ports ${this.transferPort}`;

    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -d ${this.network} -p tcp -j ${target}`);

    if (table === 'nat') target = 'RETURN';

    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -d 127.0.0.1/8    -j ${target}`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -d 192.168.0.0/16 -j ${target}`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -d 172.16.0.0/12  -j ${target}`);
    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -d 10.0.0.0/8     -j ${target}`);

    if (table === 'nat') target = `REDIRECT --to-ports ${this.transferPort}`;

    await execa.shell(`sudo iptables -t ${table} -A OUTPUT -p tcp -j ${target}`);
  }

  static async _reset(table) {
    await execa.shell(`sudo iptables -t ${table} -F OUTPUT`);
    await execa.shell(`sudo iptables -t ${table} -F OUTPUT`);
  }

  static async checkIp() {
    const apiCheck = 'https://check.torproject.org/api/ip';

    const response = await request(apiCheck);
    if (response.statusCode !== 200) throw new Error('It was not possible to establish a connection to the server.');

    return JSON.parse(response.body);
  }

  async start() {
    if (this.running) return;

    this.context = this.context || await Context.build();
    await Promise.each(this.tables, table => this._configure(table));

    await execa.shell('sudo iptables -t filter -A OUTPUT -p udp -j REJECT');
    await execa.shell('sudo iptables -t filter -A OUTPUT -p icmp -j REJECT');
    await execa.shell('sudo systemctl start tor');

    this.running = true;
  }

  async stop() {
    if (!this.running) return;

    await Promise.each(this.tables, Nipe._reset);

    return execa.shell('sudo systemctl stop tor');
  }
}

module.exports = Nipe;
