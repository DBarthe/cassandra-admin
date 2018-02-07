import cassandra from 'cassandra-driver'

class Loader {
    /**
     * Create a schema loader
     * @param {Cluster} cluster
     * @param {cassandra.Client} client
     */
    constructor(cluster, client) {
        this.cluster = cluster;
        this.client = client
    }

    /**
     * Load the list of keyspaces into the cluster object.
     * @returns {Promise<Cluster>} a promise containing the cluster object.
     */
    loadKeyspaces() {
        return new Promise((resolve, reject) =>
            this.client.eachRow("SELECT * FROM system_schema.keyspaces", [], { autoPage: true},
                (n, row) => this.cluster.addKeyspace(new Keyspace(row.keyspace_name)),
                err => err ? reject(err) : resolve(this.cluster)));
    }

    /**
     * Load the tables into their keyspaces objects.
     * @returns {Promise<Cluster>} a promise containing the cluster object.
     */
    loadTables() {
        return new Promise((resolve, reject) => {
            this.client.eachRow("SELECT * FROM system_schema.tables", [], {autoPage: true},
                (n, row) => {
                    let table = new Table(row.keyspace_name, row.table_name);
                    this.cluster.getKeyspace(row.keyspace_name).addTable(table);
                },
                err => err ? reject(err) : resolve(this.cluster))
        });
    }

    /**
     * Load the columns into their tables objects.
     * @returns {Promise<Cluster>} a promise containing the cluster object.
     */
    loadColumns() {
        return new Promise((resolve, reject) => {
            this.client.eachRow("SELECT * FROM system_schema.columns", [], {autoPage: true},
                (n, row) => {
                    let column = new Column(row.column_name, row.type, row.kind, row.position);
                    this.cluster.getKeyspace(row.keyspace_name).getTable(row.table_name).addColumn(column);
                },
                err => err ? reject(err) : resolve(this.cluster))
        });
    }

    loadIndexes() {
        const query = "SELECT * FROM system_schema.indexes WHERE keyspace_name = ? AND table_name = ?";
        return Promise.all(
            this.cluster.getKeyspaces()
                .map(ks => ks.getTables())
                .reduce((acc, x) => { acc.push(...x); return acc })
                .map(table => {
                    this.client.execute(query, [ table.keyspaceName, table.name], { prepare: true })
                        .then(result => {
                            const find = result.rows.find(row =>
                                row.kind === "CUSTOM" &&
                                row.options.class_name === "org.elassandra.index.ExtendedElasticSecondaryIndex"
                            );
                            const esIndex = find !== undefined;
                            table.esIndex = esIndex;
                        })
                })
        ).then(() => this.cluster)
    }

    /**
     * (Re)Load everything
     * @returns {Promise<Cluster>} a promise containing the cluster object.
     */
    loadAll() {
        this.cluster.clear();
        return this.loadKeyspaces()
            .then(() => this.loadTables())
            .then(() => this.loadColumns())
            .then(() => this.loadIndexes())
    }
}

class Cluster {
    constructor() {
        this.keyspaces = {}
    }

    clear() {
        this.keyspaces = {}
    }

    addKeyspace(keyspace) {
        this.keyspaces[keyspace.name] = keyspace;
    }

    getKeyspace(name) {
        return this.keyspaces[name];
    }

    getKeyspaces() {
        return Object.keys(this.keyspaces).map(name => this.getKeyspace(name));
    }
}

class Keyspace {
    constructor(name) {
        this.name = name;
        this.tables = {}
    }

    addTable(table) {
        table.keyspaceName = this.name;
        this.tables[table.name] = table;
    }

    getTable(name) {
        return this.tables[name];
    }

    getTables() {
        return Object.keys(this.tables).map(name => this.getTable(name));
    }
}

class Table {
    constructor(keyspaceName, name) {
        this.keyspaceName = keyspaceName;
        this.name = name;
        this.esIndex = false;
        this.columns = {}
    }

    addColumn(column) {
        this.columns[column.name] = column;
    }

    getColumn(name) {
        return this.columns[name];
    }
}


const Kind = Object.freeze({
    REGULAR: "regular",
    PARTITION_KEY:  "partition_key",
    CLUSTERING_KEY: "clustering",
    STATIC: "static"
});

class Column {
    constructor(name, type, kind=Kind.REGULAR, position=-1) {
        this.name = name;
        this.type = type;
        this.kind = kind;
        this.position = position;
    }
}

export default {
    Loader, Cluster, Keyspace, Table, Column, Kind
};