import cassandra from 'cassandra-driver'
import config from './config.json';

export default callback => {

    const auth = new cassandra.auth.PlainTextAuthProvider(config.cassandra.user, config.cassandra.password);

    const ssl = {
    };

    const client = new cassandra.Client({ contactPoints: config.cassandra.endpoints, authProvider: auth, sslOptions: ssl});

	callback(client);
}
