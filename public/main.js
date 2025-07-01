import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = { /* YOUR FIREBASE CONFIG HERE */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

let worldState = { agents: [], resources: [] };

onSnapshot(collection(db, 'agents'), (snapshot) => {
    worldState.agents = snapshot.docs.map(doc => doc.data());
    requestAnimationFrame(drawWorld);
});

onSnapshot(collection(db, 'resources'), (snapshot) => {
    worldState.resources = snapshot.docs.map(doc => doc.data());
});

function drawWorld() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'lime';
    worldState.resources.forEach(res => {
        ctx.beginPath();
        ctx.arc(res.location.x, res.location.y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    worldState.agents.forEach(agent => {
        if (agent.isAlive) {
            ctx.beginPath();
            ctx.arc(agent.location.x, agent.location.y, agent.phenotype.size, 0, 2 * Math.PI);
            ctx.fillStyle = agent.phenotype.color;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${agent.energy / 500})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}
