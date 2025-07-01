# EcosysX Firestore Schema

## collection: `simulations`
- **docId:** `world-01`
- **fields:**
    - `tickCount`: Number
    - `isRunning`: Boolean
    - `worldSize`: Map `{ width: Number, height: Number }`
    - `config`: Map (holds parameters like mutation rates, energy costs, etc.)

## collection: `agents`
- **docId:** `[agentId]`
- **fields:**
    - `simulationId`: String
    - `speciesType`: String ("HERBIVORE" or "CARNIVORE")
    - `isAlive`: Boolean
    - `age`: Number
    - `energy`: Number
    - `location`: GeoPoint `{ x: Number, y: Number }`
    - `state`: String (e.g., "FORAGING", "FLEEING", "SEEKING_MATE")
    - `genome`: Map `{ genes: Array<Number> }`
    - `phenotype`: Map `{ size: Number, color: String, speed: Number, sensoryRange: Number, isPredator: Boolean }`

## collection: `environment`
- **docId:** `world-01-terrain`
- **fields:**
    - `grid`: Array<Number> (A flattened 2D array representing terrain cost per cell)
    - `dimensions`: Map `{ width: Number, height: Number }`
