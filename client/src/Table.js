import React, {Component} from 'react';
import HotTable from 'react-handsontable';
import axios from "axios";
import PropTypes from "prop-types";
import { apiUrl } from './settings'

class TableCache {
    constructor(keyspaceName, tableName) {
        this.keyspaceName = keyspaceName;
        this.tableName = tableName;
        this.data = [];
        this.nextToken = null;
    }

    requestApi(fetchSize, nextToken = undefined) {
        return axios.get(`${apiUrl}/${this.keyspaceName}/${this.tableName}`, {
            params: {
                fetchSize: fetchSize,
                nextToken: nextToken || undefined
            }
        }).then(res => res.data);
    }

    fetchMore(size) {
        return this.requestApi(size, this.nextToken).then(({data, nextToken}) => {
            this.nextToken = nextToken;
            this.data = this.data.concat(data);
            return this.data;
        })
    }

    fetchUntil(size) {
        let n = size - this.data.length;
        return (n > 0) ? this.fetchMore(n) : Promise.resolve(this.data);
    }
}

class TableContainer extends Component {

    constructor(props) {
        super(props);
        this.state = {
            tableCache: null,
            loading: false,
            error: null,
            capacity: 0
        };
        this.handleEdited = this.handleEdited.bind(this);
    }

    componentDidMount() {
        this.loadData(this.props.fetchSize)
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.tableSchema !== this.props.tableSchema) {
            this.setState({
                loading: false,
                tableCache: null,
                capacity: 0
            }, () => this.loadData(this.props.fetchSize))
        }
    }

    loadData(capacity) {
        let tableCache = this.state.tableCache ||
            new TableCache(this.props.tableSchema.keyspaceName, this.props.tableSchema.name);

        this.setState(prev => ({...prev, loading: true, tableCache}));

        return tableCache.fetchUntil(capacity).then(() => {
            this.setState({
                tableCache,
                capacity: Math.max(capacity, this.state.capacity),
                loading: false,
                error: null,
            });
        }).catch(error => {
            this.setState({error})
        })
    }

    handleEdited(rowIndex, row, colName, oldValue, newValue) {
        if (newValue === "") {
            newValue = null;
        }

        this.remoteUpdateCell(row, colName, newValue).then(() => {
            this.setState(prev => {
                let tableCache = prev.tableCache;
                tableCache.data[rowIndex][colName] = newValue;
                return {
                    tableCache
                }
            }, () => console.log("row updated"));
        }).catch(err => {
            console.error(err);
            this.forceUpdate();
        })
    }


    remoteUpdateCell(row, colName, newValue) {
        let schema = this.props.tableSchema,
            colSchema = schema.columns[colName],
            columns = undefined;

        if (colSchema.kind === 'regular') {
            columns = Object.keys(schema.columns).filter(key =>
                ['partition_key', 'clustering'].indexOf(schema.columns[key].kind) !== -1);
        }
        else if (colSchema.kind === 'static') {
            columns = Object.keys(schema.columns).filter(key =>
                ['partition_key'].indexOf(schema.columns[key].kind) !== -1);
        }
        else {
            return Promise.reject("can't update a primary key");
        }

        let newRow = {};
        columns.forEach(key => newRow[key] = row[key]);
        newRow[colName] = newValue;

        return this.remoteUpdateRow(newRow);
    }

    remoteUpdateRow(newRow) {
        let schema = this.props.tableSchema,
            url = `${apiUrl}/${schema.keyspaceName}/${schema.name}`;

        return axios.put(url, newRow).then(() => {
            return newRow;
        }).catch(error => this.setState({error}));
    }

    render() {
        if (this.state.loading || this.state.tableCache === null) {
            return <p>Loading data...</p>
        }

        if (this.state.error) {
            return <p>{this.state.error.message}</p>;
        }

        return (
            <HotTableAdapter
                schema={this.props.tableSchema.columns}
                data={this.state.tableCache.data}
                onEdit={this.handleEdited}
                onColumnSelect={this.props.onColumnSelect}
            />
        );
    }
}

TableContainer.propTypes = {
    onColumnSelect: PropTypes.func.isRequired,
    tableSchema: PropTypes.object.isRequired,
    fetchSize: PropTypes.number.isRequired,
};

class HotTableAdapter extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
    }

    render() {
        return (
            <HotTable root="hot" ref={instance => this.instance = instance} settings={this.settings()}/>
        );
    }

    columnsOrder() {
        return Object.keys(this.props.schema).sort((a, b) => {
            let sa = this.props.schema[a],
                sb = this.props.schema[b];

            if (sa.kind === sb.kind) {
                if (sa.kind === 'partition_key' || sa.kind === 'clustering') {
                    return sa.position - sb.position;
                }
                else {
                    return a.localeCompare(b);
                }
            }

            let order = ['partition_key', 'clustering', 'regular', 'static'];

            for (let kind of order) {
                if (sa.kind === kind) {
                    return -1;
                }
                else if (sb.kind === kind) {
                    return 1;
                }
            }

            throw new Error("unreachable");
        })
    }

    colHeaders() {
        return this.columnsOrder().map(colName => {
            let colSchema = this.props.schema[colName];
            let kindColor = {
                'regular': 'black',
                'static': 'green',
                'partition_key': 'red',
                'clustering': 'purple',
            };
            return `<span class="colHeader columnSorting" style="color: ${kindColor[colSchema.kind]}">${colName}</span>`;
        });
    }

    data() {
        return this.props.data.map(rowDict => this.columnsOrder().map(colName => rowDict[colName]));
    }

    columns() {
        return this.columnsOrder().map(colName => {
            let colSchema = this.props.schema[colName];

            let typeMap = {
                bigint: {type: 'numeric'},
                boolean: {type: 'checkbox'},
                counter: {type: 'numeric'},
                date: {type: 'date'},
                decimal: {type: 'numeric'},
                double: {type: 'numeric'},
                float: {type: 'numeric'},
                int: {type: 'numeric'},
                timestamp: {type: 'text'}, // TODO implement time picker
                tinyint: {type: 'numeric'},
                varint: {type: 'numeric'},
            };

            return {
                type: "text",
                ...typeMap[colSchema.type] || {}
            }
        })
    }

    settings() {
        let maxColWidth = 500;

        return {
            data: this.data(),
            autoColumnSize: true,
            modifyColWidth: (width, col) => {
                return Math.min(width, maxColWidth);
            },
            columns: this.columns(),
            autoWrapRow: true,
            columnSorting: true,
            sortIndicator: true,
            rowHeaders: true,
            colHeaders: this.colHeaders(),
            //colHeaders: true,
            manualRowResize: true,
            manualColumnResize: true,
            manualColumnMove: true,
            afterChange: this.handleChange,
            afterSelection: this.handleSelect,
            afterDeselect: this.handleDeselect.bind(this)
        }
    }

    handleChange(changes, source) {
        if (source === "loadData" || source === "ObserveChanges.change") {
            return;
        }

        for (let change of changes) {
            let [rowIndex, colIndex, oldValue, newValue] = change;
            if (oldValue !== newValue) {
                let row = this.props.data[rowIndex];
                let colName = this.columnsOrder()[colIndex];

                this.props.onEdit(rowIndex, row, colName, oldValue, newValue);
            }
        }
    }

    handleSelect(r, c, r2, c2) {
        this.props.onColumnSelect(this.columnsOrder()[this.instance.hotInstance.toPhysicalColumn(c)])
    }

    handleDeselect() {
        this.props.onColumnSelect(null);
    }
}

HotTableAdapter.propTypes = {
    onColumnSelect: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired,
    schema: PropTypes.object.isRequired,
};

export default TableContainer;
