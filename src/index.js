import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import initializeDb from './db';
import middleware from './middleware';
import api from './api';
import config from './config.json';
import schema from './schema'
import path from 'path'

let app = express();
app.server = http.createServer(app);

// logger
app.use(morgan('dev'));

// 3rd party middleware
app.use(cors({
	exposedHeaders: config.corsHeaders
}));

app.use(bodyParser.json({
	limit : config.bodyLimit
}));

// connect to db
initializeDb (db => {
    // load cluster schema
    new schema.Loader(new schema.Cluster(), db).loadAll().then(cluster => {

        // internal middleware
        app.use(middleware({ config, db, cluster }));

        // api router
        app.use('/api', api({ config, db, cluster }));

				const staticDir = process.env.PUBLIC_DIR || path.join(__dirname, config.publicDir)
        app.use(express.static(staticDir));
				app.get('/*', (req, res) => {
				  res.sendFile(`${staticDir}/index.html`);

				});
        app.server.listen(process.env.PORT || config.port, () => {
            console.log(`Started on port ${app.server.address().port}`);
        });
    });
});

export default app;
