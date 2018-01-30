import React, {Component} from 'react';
import {
    BrowserRouter as Router,
    Route,
    Switch
} from 'react-router-dom'
import axios from "axios";
import Reboot from "material-ui/es/Reboot/Reboot";
import TopBar from "./TopBar";
import withStyles from "material-ui/es/styles/withStyles";
import TableContainer from "./Table";
import { apiUrl } from './settings'

const styles = {
    root: {
        width: '100%',
    },
};

const RouterApp = () => {
    return (
        <Router>
            <Switch>
                <Route path="/:keyspace?/:table?" render={({ history, match }) => {
                    return <StyleApp history={history}
                                     keyspace={match.params.keyspace || ""}
                                     table={match.params.table || ""}/>
                }}/>
            </Switch>
        </Router>
    );
};

class StyleApp extends Component {
    constructor(props) {
        super(props);
        this.App = withStyles(styles)(App);
    }

    render() {
        return (
            <div>
                <Reboot/>
                 <this.App {...this.props}/>
            </div>
        );
    }
}

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            loading: false,
            schema: null,
            keyspace: "",
            table: "",
            error: null,
            selectedColumn: null,
            fetchSize: 500,
            searchString: null
        };

        this.handleKeyspaceChange = this.handleKeyspaceChange.bind(this);
        this.handleTableChange = this.handleTableChange.bind(this);
        this.handleRefresh = this.handleRefresh.bind(this);
        this.handleFetchSizeChange = this.handleFetchSizeChange.bind(this);
    }

    componentDidMount() {
        this.fetchSchema();
    }
    
    fetchSchema(reload=false) {
        this.setState({loading: true});
        return axios[reload ? "post" : "get"](`${apiUrl}/schema`).then(res => {
            this.setState({error: null, loading: false, schema: res.data})
        }).catch(error => this.setState({error}));
    }

    handleKeyspaceChange(keyspace) {
        let table = this.tableList(keyspace).find(t => t !== "") || "";
        this.props.history.push(App.redirectUrl(keyspace, table));
    }

    handleTableChange(table) {
        this.props.history.push(App.redirectUrl(this.props.keyspace, table));
    }

    handleRefresh() {
        this.fetchSchema(true)
    }

    handleColumnSelect(colName) {
        let { keyspace, table } = this.props;
        let { schema } = this.state;

        let column = schema[keyspace].tables[table].columns[colName] || null;

        this.setState({ selectedColumn: column } )
    }

    handleFetchSizeChange(fetchSize) {
        this.setState({ fetchSize: Math.max(1, fetchSize) })
    }

    handleRequestSearch(searchString) {
        searchString = searchString.trim();
        this.setState({ searchString: searchString !== "" ? searchString : null })
    }

    static redirectUrl(keyspace, table) {
        if (keyspace === "") {
            return "/";
        }
        else if (table === "") {
            return `/${keyspace}`;
        }
        else {
            return `/${keyspace}/${table}`;
        }
    }

    keyspaceList() {
        const { schema } = this.state;

        let list = [];

        if (this.props.keyspace === "") {
            list.push("");
        }

        if (schema) {
            list.push(...Object.keys(schema));
        }

        return list
    }

    tableList(keyspace=this.props.keyspace) {
        const { schema } = this.state;

        let list = [];

        if (this.props.table === "") {
            list.push("");
        }

        if (schema && keyspace && schema[keyspace]) {
            list.push(...Object.keys(schema[keyspace].tables));
        }

        return list;
    }

    search() {
        const { error, schema } = this.state;
        const { keyspace, table } = this.props;

        return !(error || schema === null || keyspace === "" || table === "" ||
            schema[keyspace] === undefined || schema[keyspace].tables[table] === undefined ||
            schema[keyspace].tables[table].esIndex === false ||
            schema[keyspace].tables[table].columns["es_query"] === undefined
        );
    }

    render() {
        const { classes } = this.props;

        return (
            <div className={classes.root}>
                {this.renderTopBar()}
                <div style={{ paddingTop: 64}}>
                    {this.renderBody()}
                </div>

            </div>
        );
    }
    
    renderTopBar() {
        return (
            <TopBar
                keyspaceList={this.keyspaceList()}
                tableList={this.tableList()}
                keyspaceSelected={this.props.keyspace}
                tableSelected={this.props.table}
                onKeyspaceChange={this.handleKeyspaceChange}
                onTableChange={this.handleTableChange}
                onRefresh={this.handleRefresh}
                onFetchSizeChange={this.handleFetchSizeChange}
                column={this.state.selectedColumn}
                fetchSize={this.state.fetchSize}
                search={this.search()}
                onRequestSearch={(s) => this.handleRequestSearch(s)}
            />
        )
    }



    renderBody() {
        const { error, schema } = this.state;
        const { keyspace, table } = this.props;

        if (error) {
            return <p>{error.message}</p>;
        }

        if (schema === null) {
            return <p>Loading schema...</p>
        }

        if (keyspace === "" || table === "") {
            return <p>Please, select a keyspace and a table</p>
        }

        if (schema[keyspace] === undefined) {
            return <p>The requested keyspace could not be found</p>
        }

        if (schema[keyspace].tables[table] === undefined) {
            return <p>The requested table could not be found</p>
        }

        return <TableContainer tableSchema={schema[keyspace].tables[table]}
                               onColumnSelect={this.handleColumnSelect.bind(this)}
                               fetchSize={this.state.fetchSize}
                               searchString={this.state.searchString}/>
    }
}

export default RouterApp;
