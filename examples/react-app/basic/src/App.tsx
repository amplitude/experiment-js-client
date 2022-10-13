import React, { useState } from "react";
import logo from './logo.svg';
import './App.css';
import { experiment } from './index';

function App() {

  const [output, setOutput] = useState('');

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h2>Amplitude Analytics Browser Example with React</h2>
        <p>
          Click "Fetch" to fetch variants, then "Variant" or "All" to access variants from the SDK.
          <br />
          Open the console to view debug output from the SDK.
        </p>

        <button onClick={() => {
          void experiment.fetch({
            user_id: 'user@company.com',
            device_id:'abc123',
            user_properties:{ premium: true }
          });
        }}>Fetch</button>

        <button onClick={() => {
          // TODO Replace FLAG_KEY with your flag key
          const variant = experiment.variant('FLAG_KEY');
          setOutput(JSON.stringify(variant));
        }}>Variant</button>

        <button onClick={() => {
          const variants = experiment.all();
          setOutput(JSON.stringify(variants));
        }}>All</button>

        <div className="output">
          {output}
        </div>
      </header>
    </div>
  );
}

export default App;
