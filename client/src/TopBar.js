import React, {Component} from 'react';
import {Refresh} from 'material-ui-icons';
import ListSelect from './ListSelect';
import AppBar from "material-ui/es/AppBar/AppBar";
import Toolbar from "material-ui/es/Toolbar/Toolbar";
import PropTypes from "prop-types";
import withStyles from "material-ui/es/styles/withStyles";
import IconButton from "material-ui/es/IconButton/IconButton";
import Typography from "material-ui/es/Typography/Typography";
import TextField from "material-ui/TextField/TextField";
import SearchBar from './SearchBar'

const styles = theme => ({
    flex: {
        flex: 1,
    },
    refreshButton: {
    },
    numberField: {
        width: 80,
    }
});


class TopBar extends Component {
    render() {
        const { classes } = this.props;

        return (
            <AppBar position="fixed" color="default">
                <Toolbar>
                    <Typography type="title" color="inherit" className={classes.flex}>
                        Cassandra Admin
                    </Typography>

                    {!this.props.column ? null : (
                        <label className={classes.flex}>
                            <em>{ this.props.column.name }</em> :
                            <span> { this.props.column.type }</span>
                        </label>
                    )}

                    {!this.props.search ? null : (
                        <SearchBar onRequestSearch={this.props.onRequestSearch}/>
                    )}

                    <ListSelect id={"keyspace-select"}
                                label={"keyspace"}
                                list={this.props.keyspaceList}
                                selected={this.props.keyspaceSelected}
                                onChange={this.props.onKeyspaceChange}
                    />
                    <ListSelect id={"table-select"}
                                label={"table"}
                                list={this.props.tableList}
                                selected={this.props.tableSelected}
                                onChange={this.props.onTableChange}
                    />

                    <TextField type="number"
                               className={classes.numberField}
                               defaultValue={this.props.fetchSize+""}
                               label="fetch size"
                               inputProps={{
                                   min: 10,
                                   max: 1000000,
                                   step: 50
                               }}
                               onChange={e => this.props.onFetchSizeChange(e.target.value)}
                    />
                    <IconButton className={classes.refreshButton}
                                color="primary"
                                aria-label="Refresh"
                                onClick={this.props.onRefresh}>
                        <Refresh/>
                    </IconButton>

                </Toolbar>
            </AppBar>
        );
    }
}

TopBar.propTypes = {
    classes: PropTypes.object.isRequired,
    fetchSize: PropTypes.number.isRequired,
    keyspaceList: PropTypes.arrayOf(PropTypes.string),
    tableList: PropTypes.arrayOf(PropTypes.string),
    keyspaceSelected: PropTypes.string.isRequired,
    tableSelected: PropTypes.string.isRequired,
    onKeyspaceChange: PropTypes.func.isRequired,
    onTableChange: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onFetchSizeChange: PropTypes.func.isRequired
};

export default withStyles(styles)(TopBar)
