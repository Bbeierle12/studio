export class Genome {
    constructor(config) {
        this.haplotype1 = config.h1 || Array.from({ length: config.length }, () => Math.random());
        this.haplotype2 = config.h2 || Array.from({ length: config.length }, () => Math.random());
        this.length = config.length;
    }

    getEffectiveGene(index) {
        return (this.haplotype1[index] + this.haplotype2[index]) / 2;
    }

    static crossover(p1, p2) {
        const crossoverPoint = Math.floor(Math.random() * (p1.length - 1)) + 1;
        const off1_h1 = [...p1.haplotype1.slice(0, crossoverPoint), ...p2.haplotype1.slice(crossoverPoint)];
        const off1_h2 = [...p1.haplotype2.slice(0, crossoverPoint), ...p2.haplotype2.slice(crossoverPoint)];
        return new Genome({ length: p1.length, h1: off1_h1, h2: off1_h2 });
    }

    getMutatedCopy(mutationRate) {
        const mutate = (haplotype) => haplotype.map(gene => {
            if (Math.random() < mutationRate) {
                const mutation = (Math.random() - 0.5) * 0.1;
                return Math.max(0, Math.min(1, gene + mutation));
            }
            return gene;
        });
        return new Genome({ length: this.length, h1: mutate(this.haplotype1), h2: mutate(this.haplotype2) });
    }
}
