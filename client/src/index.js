import React from 'react';
import ReactDOM from 'react-dom';
import RouterApp from './App';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<RouterApp />, document.getElementById('root'));
registerServiceWorker();
