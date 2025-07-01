import { Genome } from './Genome.js';

export class Agent {
    constructor(id, config) {
        this.id = id;
        this.config = config;
        Object.assign(this, config);
        const genomeConfig = { length: config.genomeLength, h1: config.genome?.haplotype1, h2: config.genome?.haplotype2 };
        this.genome = new Genome(genomeConfig);
        this.phenotype = {};
        this.decodePhenotype();
    }

    decodePhenotype() {
        this.phenotype.speed = 1 + (this.genome.getEffectiveGene(0) * 4);
        this.phenotype.sensoryRange = 30 + (this.genome.getEffectiveGene(1) * 120);
        this.phenotype.size = this.speciesType === 'CARNIVORE' ? 7 : 5;
        const r = this.speciesType === 'CARNIVORE' ? 200 : 50;
        const g = Math.floor(this.genome.getEffectiveGene(3) * 150);
        const b = 50;
        this.phenotype.color = `rgb(${r},${g},${b})`;
    }

    update(worldState) {
        // Behavior handled in cloud function state machine
    }
}
