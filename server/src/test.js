import initializeDb from './db';
import schema from './schema';

// connect to db
initializeDb (client => {

    const cluster = new schema.Cluster();
    const loader = new schema.Loader(cluster, client);
    loader.loadAll().then(cluster => {
        console.log(cluster);
    });
});
