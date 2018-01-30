import React, {Component} from 'react';
import PropTypes from "prop-types";
import {withStyles} from 'material-ui/styles';
import SearchIcon from 'material-ui-icons/Search';
import { fade } from 'material-ui/styles/colorManipulator';

const styles = theme => ({
    // textField: {
    //     marginLeft: theme.spacing.unit,
    //     marginRight: theme.spacing.unit,
    //     width: 500,
    //     backgroundColor: theme.palette.common.white,
    //     border: '1px solid #ced4da',
    // },

    wrapper: {
        fontFamily: theme.typography.fontFamily,
        position: 'relative',
        marginRight: theme.spacing.unit * 2,
        marginLeft: theme.spacing.unit,
        borderRadius: 2,
        background: fade(theme.palette.common.white, 1),
        '&:hover': {
            background: fade(theme.palette.common.white, 1),
        },
        '& $input': {
            transition: theme.transitions.create('width'),
            width: 150,
            '&:focus': {
                width: 350,
            },
        },
    },
    search: {
        width: theme.spacing.unit * 5,
        height: '100%',
        position: 'absolute',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        font: 'inherit',
        padding: `${theme.spacing.unit}px ${theme.spacing.unit}px ${theme.spacing.unit}px ${theme
            .spacing.unit * 5}px`,
        border: 0,
        display: 'block',
        verticalAlign: 'middle',
        whiteSpace: 'normal',
        background: 'none',
        margin: 0, // Reset for Safari
        color: 'inherit',
        width: '100%',
        '&:focus': {
            outline: 0,
        },
    },
});


class SearchBar extends Component {

    constructor(props) {
        super(props);
        this.state = {
            value: ""
        }
    }

    handleKeyPressed(e) {
        console.log("keypressed", e.charCode)
        if (e.charCode === 13) {
            this.props.onRequestSearch(this.state.value)
        }
    }

    handleChange(e) {
        this.setState({ value: e.target.value })
    }

    render() {
        const { classes } = this.props;

        return (
            <div className={classes.wrapper}>
                <div className={classes.search}>
                    <SearchIcon />
                </div>
                <input id="search" className={classes.input}
                        onKeyPress={(e) => this.handleKeyPressed(e)}
                        onChange={(e) => this.handleChange(e)}
                        value={this.state.value}
                />
            </div>
        );

    }
}

SearchBar.propTypes = {
    classes: PropTypes.object.isRequired,
    onRequestSearch: PropTypes.func.isRequired
};

export default withStyles(styles)(SearchBar);