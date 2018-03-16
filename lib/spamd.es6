import net from 'net';
import Receiver from './receiver';

export default class Spamd {
  static INVALID_RECEIVER = 'Invalid sender and receiver';
  static NO_CALLBACK = 'Evaluate method requires a callback';

  _host = 'localhost';
  _port = 783;

  constructor(host, port) {
    if(typeof host !== 'undefined'){
      this._host = host;
    }

    if(typeof port !== 'undefined'){
      this._port = port;
    }
  }

  evaluate(sender, receiver, subject, body) {
    sender = typeof sender === 'undefined' ? 'root' : sender;
    receiver = typeof receiver === 'undefined' ? 'root' : receiver;

    if( sender === receiver === 'root') {
      throw this.INVALID_RECEIVER;
    }

    let headers = 'Message-ID: <4F452339.1040102@'+ this._host +'>\r\n';
    headers += 'Date: ' + new Date().toUTCString() + '\r\n';
    headers += 'From: ' + sender + '\r\n';
    headers += 'MIME-Version: 1.0\r\n';
    headers += 'To: ' + receiver + '\r\n';
    headers += 'Subject: ' + subject + '\r\n';
    headers += 'Content-Type: text/plain; charset=UTF-8; format=flowed\r\n';
    headers += 'Content-Transfer-Encoding: quoted-printable\r\n';
    headers += '\r\n' + body;

    //console.log(headers);

    let connection = net.connect(this._port, this._host, () => {

      connection.write("SYMBOLS SPAMC/1.3\r\n", undefined, () => {
        connection.write("User: " + receiver + "\r\n\r\n", undefined, () => {
          connection.write("X-Envelope-From: " + sender + "\r\n", undefined, () => {
            connection.write(headers);
            connection.end('\r\n');
          });
        });
      });

    });

    return new Promise((resolve, reject) => {
      let recv = new Receiver(resolve, reject);
      connection.on('end', recv.end.bind(recv));
      connection.on('error', recv.error.bind(recv));
      connection.on('timeout', recv.timeout.bind(recv));
      connection.on('data', recv.data.bind(recv));
    });

  }
}