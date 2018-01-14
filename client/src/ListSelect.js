import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {withStyles} from 'material-ui/styles';
import Input, {InputLabel} from 'material-ui/Input';
import {FormControl} from 'material-ui/Form';
import Select from 'material-ui/Select';

const styles = theme => ({
    formControl: {
        margin: theme.spacing.unit,
        minWidth: 120,
    },
    selectEmpty: {
        marginTop: theme.spacing.unit * 2,
    },
});

class ListSelect extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(event) {
        this.props.onChange(event.target.value);
    }

    render() {
        const {classes, id, label, list, selected } = this.props;

        return (
            <FormControl className={classes.formControl}>
                <InputLabel htmlFor={id}>{label}</InputLabel>
                <Select native
                        value={selected}
                        onChange={this.handleChange}
                        input={<Input id={id}/>}>
                    {
                        list.map((item, i) => {
                            return <option key={i} value={item}>{item}</option>
                        })
                    }
                </Select>
            </FormControl>
        )
    }
}

ListSelect.propTypes = {
    classes: PropTypes.object.isRequired,
    id: PropTypes.string.isRequired,
    label:PropTypes.string.isRequired,
    list: PropTypes.arrayOf(PropTypes.string),
    selected: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

export default withStyles(styles)(ListSelect);
