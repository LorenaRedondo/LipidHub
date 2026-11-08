# Roadmap

Phased plan of work. Open items are tracked as GitHub issues.

## Done
- Ingest of LIPID MAPS LMSD with real curated-species marking; rule-based enumeration of the gap set (`origin = in_silico`).
- Property engine v1: RDKit formula/mass/logP/TPSA/SAScore; trained CCS & RT models with conformal intervals.
- Synthesizability scoring (biosynthetic pathway match + chemical SAScore); live UniProt/Rhea pathway graph.
- Class coverage: sphingolipids, sterols/oxysterols, cardiolipin.
- REST API and MCP server; provenance and confidence shown on every value; accessibility pass on the gap map.

## Open
- [#2](https://github.com/LorenaRedondo/LipidHub/issues/2) REST + SPARQL API and bulk export
- [#3](https://github.com/LorenaRedondo/LipidHub/issues/3) Perf pass and GitHub Pages deploy
- [#4](https://github.com/LorenaRedondo/LipidHub/issues/4) Prototype fidelity: externalize data, adduct selector
- [#5](https://github.com/LorenaRedondo/LipidHub/issues/5) Class coverage: archaeal/prenol ether lipids, gangliosides
- [#6](https://github.com/LorenaRedondo/LipidHub/issues/6) Curated per-species literature citations
- [#7](https://github.com/LorenaRedondo/LipidHub/issues/7) Production infrastructure
- [#8](https://github.com/LorenaRedondo/LipidHub/issues/8) Resource paper and prediction benchmarking
- [#9](https://github.com/LorenaRedondo/LipidHub/issues/9) CCS/RT per adduct and method, GNN, monotonicity
- [#10](https://github.com/LorenaRedondo/LipidHub/issues/10) Client packages and pipeline plugins
- [#11](https://github.com/LorenaRedondo/LipidHub/issues/11) Physics-informed property engine
- [#12](https://github.com/LorenaRedondo/LipidHub/issues/12) Retrosynthesis route generation
- [#13](https://github.com/LorenaRedondo/LipidHub/issues/13) Cross-reference pathway enzymes with chemical probes/drugs
- [#14](https://github.com/LorenaRedondo/LipidHub/issues/14) Mixture calculator and phase diagram as MCP tools
