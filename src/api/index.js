import { version } from '../../package.json';
import { Router } from 'express';
import schema from '../schema';

export default ({ config, db, cluster }) => {
	let api = Router();

	console.log(schema.Kind.CLUSTERING_KEY);

	api.get('/schema', (req, res) => {
	    res.json(cluster.keyspaces)
    });

    api.post('/schema', (req, res) => {
        new schema.Loader(cluster, db).loadAll().then((cluster)  => {
            res.json(cluster.keyspaces);
        }).catch(err => res.status(500).json({
            errorCode: 500,
            message: "Cassandra driver returned an error",
            cassandraError: err
        }));
    });

	api.get('/schema/:keyspaceName', (req, res) => {
        validateKeyspace(res, req.params.keyspaceName, keyspace => res.json(keyspace));
    });

    api.get('/schema/:keyspaceName/:tableName', (req, res) => {
        validateTable(res, req.params.keyspaceName, req.params.tableName, table => res.json(table));
    });

    api.get('/:keyspaceName/:tableName', (req,res) => {
        validateTable(res, req.params.keyspaceName, req.params.tableName, table => {
            const pageState = req.query.nextToken || undefined;
            const fetchSize = req.query.fetchSize || config.cassandra.defaultFetchSize;
            const options = { pageState : pageState, prepare : true, fetchSize : fetchSize};
            let data = [],
                query = "SELECT * FROM " + table.keyspaceName + "." + table.name,
                params = [];

            if (req.query.search) {
                let esQuery = {
                    query: {
                        query_string : {
                            query : req.query.search
                        }
                    }
                };
                query = `${query} WHERE es_query = ? LIMIT 500`;
                params.push(JSON.stringify(esQuery))
            }
            console.log(query, params)
            db.eachRow(query, params, options,
                (n, row) => data.push(row),
                (err, rs) => {
                    if (err) {
                        res.status(500).json({
                            errorCode: 500,
                            message: "Cassandra driver returned an error",
                            cassandraError: err
                        });
                    }
                    else {
                        res.json({
                            nextToken: rs.pageState,
                            data: data
                        });
                    }
                }
            );
        });
    });

    api.post('/:keyspaceName/:tableName', ({ params, body }, res) => {
        validateTable(res, params.keyspaceName, params.tableName, table => {

            let columns = [], values = [];

            Object.keys(table.columns).forEach(key => {
                let value = body[key], column = table.getColumn(key);

                if (value !== undefined) {
                    columns.push(column.name);
                    values.push(value);
                }
                else if (column.kind === schema.Kind.CLUSTERING_KEY || column.kind === schema.Kind.PARTITION_KEY) {
                    return res.status(400).json({
                        errorCode: 400,
                        message: "Missing " + column.kind + " column '" + column.name + "'"
                    })
                }
            });

            const valuesPlaceholders = ",?".repeat(columns.length).substr(1);
            const query = "INSERT INTO " + table.keyspaceName + "." + table.name +
                " (" + columns.join(",") + ") VALUES (" + valuesPlaceholders + ")";
            db.execute(query, values)
                .then(() => res.json({ message: "One row inserted or updated"}))
                .catch(err => res.status(500).json({
                    errorCode: 500,
                    message: "Cassandra driver returned an error",
                    cassandraError: err
                }));
        });
    });


    api.put('/:keyspaceName/:tableName',  ({ params, body }, res) => {

        validateTable(res, params.keyspaceName, params.tableName, table => {

            let partitionColumns = [], partitionValues = [];
            let clusteringColumns = [], clusteringValues = [];

            let dataColumns = [], dataValues = [];
            let onlyStatic = true;

            Object.keys(table.columns).forEach(key => {
                let value = body[key], column = table.getColumn(key);

                if (value !== undefined) {
                    if (column.kind === schema.Kind.CLUSTERING_KEY) {
                        clusteringColumns.push(column.name);
                        clusteringValues.push(value);
                    }
                    else if (column.kind === schema.Kind.PARTITION_KEY) {
                        partitionColumns.push(column.name);
                        partitionValues.push(value);
                    }
                    else {
                        if (column.kind !== schema.Kind.STATIC) {
                            onlyStatic = false;
                        }
                        dataColumns.push(column.name);
                        dataValues.push(value);
                    }
                }
            });

            if (dataColumns.length === 0) {
                return res.status(400).json({
                    errorCode: 400,
                    message: "The request contains no column to update"
                })
            }

            Object.keys(table.columns).forEach(key => {
                let value = body[key], column = table.getColumn(key);

                if (value === undefined) {
                    if (column.kind === schema.Kind.PARTITION_KEY) {
                        return res.status(400).json({
                            errorCode: 400,
                            message: "Missing partition key '" + column.name + "'"
                        })
                    }
                    else if (onlyStatic === false && column.kind === schema.Kind.CLUSTERING_KEY) {
                        return res.status(400).json({
                            errorCode: 400,
                            message: "Missing clustering key '" + column.name + "'"
                        })
                    }
                }
            });


            let idValues = partitionValues, idColumns = partitionColumns;
            if (!onlyStatic) {
                idValues = idValues.concat(clusteringValues);
                idColumns = idColumns.concat(clusteringColumns);
            }

            const idValuesPlaceholders = idColumns.map(function(column, i) {
                return column + " = ?";
            }).join(" AND ");

            const dataValuesPlaceholders = dataColumns.map(function(column, i) {
                return column + " = ?";
            }).join(", ");

            const query = "UPDATE " + table.keyspaceName + "." + table.name +
                " SET " + dataValuesPlaceholders + " WHERE " + idValuesPlaceholders;

            db.execute(query, dataValues.concat(idValues), { prepare: true })
                .then(() => res.json({ message: "One row inserted or updated"}))
                .catch(err => res.status(500).json({
                    errorCode: 500,
                    message: "Cassandra driver returned an error",
                    cassandraError: err
                }));
        });
    });

    api.delete('/:keyspaceName/:tableName', ({ params, body, query }, res) => {

        validateTable(res, params.keyspaceName, params.tableName, table => {

            if (query.columns !== undefined) {
                let dataColumns = query.columns.split(",")
                if (dataColumns.length > 0) {
                    return deleteColumns(res, body, table, dataColumns);
                }
            }

            let idColumns = [], idValues = [];

            Object.keys(table.columns).forEach(key => {
                let value = body[key], column = table.getColumn(key);

                if (column.kind === schema.Kind.CLUSTERING_KEY || column.kind === schema.Kind.PARTITION_KEY) {
                    if (value !== undefined) {
                        idColumns.push(column.name);
                        idValues.push(value);
                    }
                    else {
                        return res.status(400).json({
                            errorCode: 400,
                            message: "Missing " + column.kind + " column '" + column.name + "' in id"
                        })
                    }
                }
            });

            const idValuesPlaceholders = idColumns.map(function(column, i) {
                return column + " = ?";
            }).join(" AND ");

            const cqlQuery = "DELETE FROM " + table.keyspaceName + "." + table.name +
                " WHERE " + idValuesPlaceholders;
            db.execute(cqlQuery, idValues)
                .then(() => res.json({message: "One row deleted"}))
                .catch(err => res.status(500).json({
                    errorCode: 500,
                    message: "Cassandra driver returned an error",
                    cassandraError: err
                }));
        })
    });

    function deleteColumns(res, body, table, dataColumns) {

        let partitionColumns = [], partitionValues = [];
        let clusteringColumns = [], clusteringValues = [];

        Object.keys(table.columns).forEach(key => {
            let value = body[key], column = table.getColumn(key);

            if (column.kind === schema.Kind.CLUSTERING_KEY || column.kind === schema.Kind.PARTITION_KEY) {
                if (value !== undefined) {
                    if (column.kind === schema.Kind.CLUSTERING_KEY) {
                        clusteringColumns.push(column.name);
                        clusteringValues.push(value);
                    }
                    else {
                        partitionColumns.push(column.name);
                        partitionValues.push(value);
                    }
                }
            }
        });


        let onlyStatic = true;

        dataColumns.forEach(key => {
            let column = table.getColumn(key), value = table.getColumn(key);
            if (column === undefined) {
                return res.status(400).json({
                    errorCode: 400,
                    message: "Unknown column name '" + key + "'"
                })
            }
            else if (column.kind === schema.Kind.REGULAR) {
                onlyStatic = false;
            }
            else if (!column.kind === schema.Kind.STATIC) {
                return res.status(400).json({
                    errorCode: 400,
                    message: "Can't delete a partition key column"
                })
            }
        });

        Object.keys(table.columns).forEach(key => {
            let column = table.getColumn(key), value = body[key];

            if (column.kind === schema.Kind.PARTITION_KEY && value === undefined) {
                return res.status(400).json({
                        errorCode: 400,
                        message: "Missing partition key '" + column.name + "'"
                })
            }
            else if (onlyStatic === false && column.kind === schema.Kind.CLUSTERING_KEY && value === undefined) {
                return res.status(400).json({
                    errorCode: 400,
                    message: "Missing clustering key '" + column.name + "'"
                })
            }
        });


        let idColumns = partitionColumns, idValues = partitionValues;
        if (!onlyStatic) {
            idColumns = idColumns.concat(clusteringColumns);
            idValues = idValues.concat(clusteringValues);
        }

        const idValuesPlaceholders = idColumns.map(function(column, i) {
            return column + " = ?";
        }).join(" AND ");

        const query = "DELETE " + dataColumns.join(",") + " FROM " + table.keyspaceName + "." + table.name +
            " WHERE " + idValuesPlaceholders;
        db.execute(query, idValues)
            .then(() => res.json({ message: dataColumns.length + " column(s) deleted"}))
            .catch(err => res.status(500).json({
                errorCode: 500,
                message: "Cassandra driver returned an error",
                cassandraError: err
            }));
    }

    function validateKeyspace(res, keyspaceName, callback) {
        let keyspace = cluster.getKeyspace(keyspaceName);
        if (typeof keyspace === 'undefined') {
            return res.status(404).json({ message: "The requested keyspace couldn't be found", errorCode: 404 });
        }
        else {
            callback(keyspace);
        }
    }

    function validateTable(res, keyspaceName, tableName, callback) {
        validateKeyspace(res, keyspaceName, keyspace => {
            let table = keyspace.getTable(tableName);
            if (typeof table === 'undefined') {
                res.status(404).json({ message: "The requested table couldn't be found", errorCode: 404 });
            }
            else {
                callback(table)
            }
        });
    }

    // perhaps expose some API metadata at the root
	api.get('/', (req, res) => {
		res.json({ version });
	});

	return api;
}
