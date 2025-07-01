const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const agentStates = {
    FORAGING: (agent, world) => {
        const nearestPredator = findNearest(agent, world.agents.filter(a => a.phenotype.isPredator), agent.phenotype.sensoryRange);
        if (nearestPredator) {
            agent.state = 'FLEEING';
            return;
        }
        const target = findNearest(agent, world.resources, agent.phenotype.sensoryRange);
        moveTowards(agent, target, agent.phenotype.speed, world.worldSize);
    },
    FLEEING: (agent, world) => {
        const nearestPredator = findNearest(agent, world.agents.filter(a => a.phenotype.isPredator), agent.phenotype.sensoryRange);
        if (nearestPredator) {
            moveAwayFrom(agent, nearestPredator, agent.phenotype.speed, world.worldSize);
        } else {
            agent.state = 'FORAGING';
        }
    },
    HUNTING: (agent, world) => {
        const target = findNearest(agent, world.agents.filter(a => !a.phenotype.isPredator), agent.phenotype.sensoryRange);
        moveTowards(agent, target, agent.phenotype.speed, world.worldSize);
    }
};

function findNearest(agent, targets, range) {
    let minDist = Infinity;
    let nearest = null;
    for (const t of targets) {
        const dist = Math.hypot(agent.location.x - t.location.x, agent.location.y - t.location.y);
        if (dist < minDist && dist <= range) {
            minDist = dist;
            nearest = t;
        }
    }
    return nearest;
}

function moveTowards(agent, target, speed, worldSize) {
    if (!target) return;
    const dx = target.location.x - agent.location.x;
    const dy = target.location.y - agent.location.y;
    const len = Math.hypot(dx, dy) || 1;
    agent.location.x = Math.min(worldSize.width, Math.max(0, agent.location.x + (dx / len) * speed));
    agent.location.y = Math.min(worldSize.height, Math.max(0, agent.location.y + (dy / len) * speed));
}

function moveAwayFrom(agent, threat, speed, worldSize) {
    if (!threat) return;
    const dx = agent.location.x - threat.location.x;
    const dy = agent.location.y - threat.location.y;
    const len = Math.hypot(dx, dy) || 1;
    agent.location.x = Math.min(worldSize.width, Math.max(0, agent.location.x + (dx / len) * speed));
    agent.location.y = Math.min(worldSize.height, Math.max(0, agent.location.y + (dy / len) * speed));
}

exports.simulationTick = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).pubsub.schedule('every 1 minutes').onRun(async () => {
    const simRef = db.collection('simulations').doc('world-01');
    const simDoc = await simRef.get();
    if (!simDoc.exists || !simDoc.data().isRunning) return null;

    const config = simDoc.data().config;
    const agentDocs = await db.collection('agents').get();
    const resourceDocs = await db.collection('resources').get();

    const world = {
        agents: agentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        resources: resourceDocs.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        worldSize: config.worldSize
    };

    const batch = db.batch();

    world.agents.forEach(agent => {
        if (!agent.isAlive) return;

        agent.energy -= (config.metabolicCostBase + (agent.phenotype.speed * config.metabolicCostSpeedFactor));
        agent.age += 1;

        if (agent.energy <= 0 || agent.age > agent.phenotype.maxLifespan) {
            agent.isAlive = false;
            batch.delete(db.collection('agents').doc(agent.id));
            return;
        }

        const stateLogic = agent.speciesType === 'CARNIVORE' ? agentStates.HUNTING : agentStates[agent.state];
        if (stateLogic) stateLogic(agent, world);

        if (agent.speciesType === 'HERBIVORE') {
            const eatenIndex = world.resources.findIndex(r => Math.hypot(agent.location.x - r.location.x, agent.location.y - r.location.y) < agent.phenotype.size);
            if (eatenIndex > -1) {
                agent.energy += world.resources[eatenIndex].energyValue;
                batch.delete(db.collection('resources').doc(world.resources[eatenIndex].id));
                world.resources.splice(eatenIndex, 1);
            }
        } else {
            const preyIndex = world.agents.findIndex(p => p.isAlive && p.speciesType === 'HERBIVORE' && Math.hypot(agent.location.x - p.location.x, agent.location.y - p.location.y) < agent.phenotype.size);
            if (preyIndex > -1) {
                agent.energy += world.agents[preyIndex].energy;
                world.agents[preyIndex].isAlive = false;
                batch.delete(db.collection('agents').doc(world.agents[preyIndex].id));
            }
        }

        if (agent.energy > config.reproEnergyCost) {
            agent.energy -= config.reproEnergyCost;
            // placeholder for reproduction logic
        }

        batch.update(db.collection('agents').doc(agent.id), { location: agent.location, energy: agent.energy, age: agent.age, state: agent.state });
    });

    if (Math.random() < config.foodReplenishRate && world.resources.length < config.maxResources) {
        const newResId = db.collection('resources').doc().id;
        batch.set(db.collection('resources').doc(newResId), {
            location: { x: Math.random() * world.worldSize.width, y: Math.random() * world.worldSize.height },
            energyValue: config.foodEnergyValue
        });
    }

    batch.update(simRef, { tickCount: admin.firestore.FieldValue.increment(1), populationSize: world.agents.filter(a => a.isAlive).length });

    await batch.commit();
    console.log('Tick complete.');
    return null;
});
