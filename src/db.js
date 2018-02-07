import cassandra from 'cassandra-driver'
import config from './config.json';

export default callback => {

    const auth = new cassandra.auth.PlainTextAuthProvider(
        process.env.CASSANDRA_USER || config.cassandra.user,
        process.env.CASSANDRA_PASSWORD || config.cassandra.password);


    let endpoints = config.cassandra.endpoints;
    if (process.env.CASSANDRA_ENDPOINTS) {
        endpoints = process.env.CASSANDRA_ENDPOINTS.split(",");
    }

    const ssl = {};

    const client = new cassandra.Client({
        contactPoints: endpoints,
        authProvider: auth, sslOptions: ssl});

	callback(client);
}
