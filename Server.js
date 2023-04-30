const States = require('./Models/States');
const statesData = require('./DB/statesData.json');
const connectDB = require('./DB/MongoConnection');
const express = require('express');
const app = express();
const bodyParser = require('body-parser')
var cors = require('cors');

app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;
app.use(cors());


// Connect to MongoDB
connectDB();

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(__dirname + '/index.html');
});


app.get('/states', async (req, res) => {
    const isContig = req.query.contig === 'true';

    let filteredStates = statesData;
    if (isContig) {
        filteredStates = statesData.filter(state => state.code !== 'AK' && state.code !== 'HI');
    } else if (req.query.contig === 'false') {
        filteredStates = statesData.filter(state => state.code === 'AK' || state.code === 'HI');
    }

    try {
        const dbStates = await States.find();

        const dbStatesMap = dbStates.reduce((map, dbState) => {
            map[dbState.stateCode] = dbState;
            return map;
        }, {});

        const states = filteredStates.map(state => {
            const dbState = dbStatesMap[state.code];
            return dbState ? { ...state, funFacts: dbState.funFacts } : state;
        });

        res.json(states);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});



// app.get('/states/', async (req, res) => {
//     try {
//         const dbStates = await States.find();

//         const dbStatesMap = dbStates.reduce((map, dbState) => {
//             map[dbState.stateCode] = dbState;
//             return map;
//         }, {});

//         const states = statesData.map(state => {
//             const dbState = dbStatesMap[state.code];
//             return dbState ? { ...state, funFacts: dbState.funFacts } : state;
//         });

//         res.json(states);
//     } catch (err) {
//         console.log(err);
//         res.status(500).json({ error: 'Server error' });
//     }
// });



app.get('/states/:state', async (req, res) => {
    const stateCode = req.params.state.toUpperCase();
    const state = statesData.find(state => state.code === stateCode);

    if (!state) {
        return res.status(404).json({ error: 'Invalid state abbreviation parameter' });
    }

    try {
        const dbState = await States.findOne({ stateCode: stateCode });
        if (dbState) {
            state.funFacts = dbState.funFacts;
        }
        res.json(state);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});





app.get('/states/:state/funfact', async (req, res) => {
    const stateCode = (req.params.state).toUpperCase();
    const state = statesData.find(state => state.code === stateCode);

    try {
        if (!state) {
            return res.status(400).json({ message: 'Invalid state abbreviation parameter' });
        }

        const dbState = await States.findOne({ stateCode });
        if (dbState) {
            const funFacts = dbState.funFacts;
            const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
            res.json({ funfact: randomFact });
        } else {
            res.json({ message: `No Fun Facts found for ${state.state}` });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});




app.get('/states/:state/capital', (req, res) => {
    const stateCode = (req.params.state).toUpperCase();

    // Check if the state abbreviation is valid
    const state = statesData.find(state => state.code === stateCode);
    if (!state) {
        res.status(400).json({ message: 'Invalid state abbreviation parameter' });
        return;
    }

    res.send({ state: state.state, capital: state.capital_city });
});


app.get('/states/:state/nickname', (req, res) => {
    const stateCode = req.params.state.toUpperCase();
    const state = statesData.find(state => state.code === stateCode);

    if (!state) {
        res.status(400).json({ message: 'Invalid state abbreviation parameter' });
        return;
    }

    const nickname = state.nickname;
    res.send({ state: state.state, nickname: nickname });
});



app.get('/states/:state/population', (req, res) => {
    const stateCode = (req.params.state).toUpperCase();
    const state = statesData.find(s => s.code === stateCode);

    if (!state) {
        res.status(400).json({ message: 'Invalid state abbreviation parameter' });
        return;
    }

    const populationString = state.population.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    res.send({ state: state.state, population: populationString });
});




app.get('/states/:state/admission', (req, res) => {
    const stateCode = req.params.state.toUpperCase();
    const state = statesData.find(s => s.code === stateCode);

    if (!state) {
        res.status(400).json({ message: 'Invalid state abbreviation parameter' });
    }

    res.send({ state: state.state, admitted: state.admission_date });
});


app.post('/states/:state/funfact', async (req, res) => {
    const stateCode = req.params.state.toUpperCase();
    const funFacts = req.body.funfacts;

    try {
        const state = statesData.find(s => s.code === stateCode);

        if (!state) {
            res.status(400).json({ message: 'Invalid state abbreviation parameter' });
        }

        const existingState = await States.findOne({ stateCode: stateCode });

        let newState;
        if (!existingState) {
            const mongoObject = {
                stateCode: state.code,
                funFacts: funFacts,
            };
            newState = await States.create(mongoObject);
        } else {
            existingState.funFacts.push(...funFacts);
            await existingState.save();
            newState = existingState;
        }

        res.json(newState);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});


app.patch('/states/:state/funfact', async (req, res) => {
    const stateCode = req.params.state;
    const { index, funfacts } = req.body;

    try {
        const state = await States.findOne({ stateCode });

        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }

        if (!index) {
            return res.status(400).json({ error: 'Index parameter is required' });
        }

        const adjustedIndex = index - 1;

        if (adjustedIndex < 0 || adjustedIndex >= state.funFacts.length) {
            return res.status(400).json({ error: 'Invalid index' });
        }

        state.funFacts[adjustedIndex] = funfacts[0];
        await state.save();
        res.json(state);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});


app.delete('/states/:state/funfact', async (req, res) => {
    const stateCode = req.params.state;
    const { index } = req.body;

    try {
        const state = await States.findOne({ stateCode });

        if (!state) {
            return res.status(404).json({ error: 'State not found' });
        }

        if (!index) {
            return res.status(400).json({ error: 'Index parameter is required' });
        }

        const adjustedIndex = index - 1;


        if (adjustedIndex < 0 || adjustedIndex >= state.funFacts.length) {
            return res.status(400).json({ error: 'Invalid index' });
        }

        state.funFacts.splice(adjustedIndex, 1);

        await state.save();
        res.json(state);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Server error' });
    }
});




// catch-all route for 404 errors
app.get('*', (req, res) => {
    res.status(404).sendFile(__dirname + '/404.html');
});

// app.get('*', (req, res) => {
//     if (req.accepts('html')) {
//         res.status(404).send('<h1>404</h1>');
//     } else if (req.accepts('json')) {
//         res.status(404).json({ error: '404 Not Found' });
//     } else {
//         res.status(404).send('Not found');
//     }
// });


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


