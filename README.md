# Mes 600 S - plant explained

- **Live interactive web page (GitHub Pages):** <https://faustinopalma.github.io/schema-centrale-termica/>
- **Local offline preview:** build with `npm run build` and open `dist/index.html` in Microsoft Edge.

The self-contained single-screen page works offline and selects Italian, Simplified Chinese or English from the browser's ordered language preferences (English fallback), with a manual language selector and light/dark theme toggle on the top bar.

The explanation advances through **three sequential landscape steps** inside a single viewport free of page scrolling:

1. **Step 1 — Theoretical principle (1 heat pump):** introduces open groundwater exchange, one water-to-water heat pump with an interactive four-stage refrigeration-cycle zoom, and one closed apartment radiant-floor loop (38 → 33 °C in winter heating, 18 → 23 °C in summer cooling).
2. **Step 2 — Domestic hot-water integration:** adds the closed 40/35 °C intermediate loop between PC2 and PC1, the 70/65 °C primary loop across SC1, the 60 °C potable storage cylinder S2, and the 48 °C thermostatic mixer. It distinguishes open apartment tap draw-off (discharged after use) from the warm (~46–48 °C) stairwell riser recirculation loop driven by P02/P03, while cold mains water (~15 °C, AFP) enters from the potable treatment train.
3. **Step 3 — Complete condominium plant (multiple units and pressure zones):** expands every functional group into the building's parallel units and pressure zones: 3 submersible extraction pumps across 2 wells (P1 with 2 × P11 and reserve well P2 with P10), hydrocyclone T6, 2 parallel T7 filters, 2 side-branch S4 vessels, 2 reinjection wells R1, 2 parallel PC2 units, 4 S3 buffers (two parallel pairs on supply headers), 3 HVAC branches (P06 communal, P07 low-pressure BP, and P08 → SC2 → P09 high-pressure AP), the potable booster station (T1, 2 × S1, GP1 MP, GP2 BP, 2 × T2, T3/T4), and twin MP/BP domestic hot-water lines (2 × SC1, 2 × P01, 2 × S2, 2 × mixers, P02 and P03).

A 60 fps arc-length `requestAnimationFrame` engine animates continuous fluid capsules, dynamic temperature transitions across exchanger coils, thermal transfer chevrons and compressor rotors, switching to static directional markers when reduced motion is enabled.

Desktop viewports display an explanatory step banner, Equipment model/capacity annotations and an interactive active-tag bar. Phone landscape viewports present a decluttered toolbar and crisp primary labels within the same connected schematic. Portrait orientation displays a rotation prompt and recommends opening the page on a PC for full technical detail. Selecting **Tags (P1, S3…)** or any tag badge opens a filterable glossary of plant codes with a highlight-on-schematic action.

## Private source and publication

The original drawing has been moved to **[private/](private/)**, which is excluded by **[.gitignore](.gitignore)**. It has no website link, PDF viewer button or public source-register entry. S00 remains a textual citation to privately held design evidence.

The build creates **[dist/](dist/)** from an explicit allowlist of public HTML, derived diagrams and manufacturer documents, and **[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)** deploys only `dist/` to GitHub Pages after running the graph test suite and privacy checks. The private PDF remains exclusively in the local gitignored `private/` folder; the build does not require it.

## The plant in one minute

1. **Groundwater exchanges heat with two PC2 heat pumps.** In winter it supplies heat; in summer it receives rejected heat. The main extraction well P1 has two P11 pumps; P2 is marked reserve and has P10. A hydrocyclone T6 and two T7 filters protect the source-water circuit. Two S4 pressure vessels help stabilise pressure.
2. **PC2 serves the building heating/cooling loop.** Two S3 thermal buffers add inertia. P06 serves Tower B communal spaces, P07 serves low-pressure residential branches, and P08 feeds SC2. Across SC2, P09 serves the separate high-pressure residential circuit.
3. **A second temperature stage produces domestic hot water.** PC2 feeds an intermediate 40/35 deg C circuit with two additional S3 buffers. P05 circulates that water through PC1, which raises the temperature for a 70/65 deg C primary loop circulated by P04.
4. **Two SC1 exchangers charge two S2 potable-water tanks.** Each branch has a 90 kW exchanger, a P01 charging pump and a 3,000 L tank annotated 60 deg C. Mixing provides a 48 deg C distribution annotation; P02 and P03 serve the respective medium- and low-pressure recirculation branches.

Heat passes through exchanger surfaces. Groundwater, closed-loop heating water and drinking water stay in their own circuits.

These are design annotations from the privately held drawing, p.1 (S00). Equipment installation, actual operating temperatures and current control settings have not been verified.

## Modes and boundaries

| Function | Main energy path | Evidence boundary |
| --- | --- | --- |
| Winter heating | Groundwater -> PC2 -> building loop -> occupied spaces | PC2 schedule gives 45/40 deg C; downstream residential labels give 42/38 deg C. |
| Summer cooling | Occupied spaces -> PC2 -> groundwater | PC2 selection gives 10/15 deg C; main pipes also show 8/13 deg C. These need reconciliation. |
| Domestic hot water | PC2 intermediate loop -> PC1 -> SC1 -> S2 -> mixed supply | The 40/35, 70/65 and 60/55 deg C values belong to different circuits. |
| Cooling with hot-water recovery | Building heat -> PC2 intermediate loop -> PC1 -> DHW | Supported by the MSW family literature and consistent with the drawing. Installed priority and simultaneous capacities need confirmation. |

The source shows an emergency bypass near PC1, with normally closed valves. It is omitted from the normal-flow diagrams. No bypass operation or degraded-mode output is established here.

## Supporting water systems

- Incoming mains water passes T1. Two S1 vessels precede the GP1/GP2 potable-water booster sets and the pressure-zone branches.
- Two T2 softeners treat DHW-feed water, with separate T3 anti-Legionella and T4 anticorrosion dosing positions. T5 is associated with closed-loop make-up water treatment.
- Apartment modules provide metering, demand control and mixing for radiant panels, with a separate dehumidifier connection.
- A 3.5 m3 rainwater tank and P12 serve irrigation; a groundwater connection also reaches the irrigation arrangement.
- A separate mains branch fills a fire-water tank. The drawing does not describe the complete firefighting system.

## Important unresolved items

The minisite has a location-specific verification register. The principal findings are:

- **Temperatures:** PC2 tables, pipe labels, SC2 selections and typical communal-space terminal details do not all agree.
- **PC1 performance:** 180.5 kW / 37 kW calculates to 4.88; the drawing prints COP 5.00. P05 also has a questionable current/power pairing.
- **Nobel references:** the candidate NIC 108-K sheet gives 6 bar, whereas T6 is drawn at 8 bar. The candidate ML100 filter gives 60 m3/h and 30 W, whereas T7 lists 65 m3/h and 10 W. These documents explain possible technologies and do not confirm installed models.
- **Pressure envelope:** GP1/GP2 head annotations and the local pressure at T2 need a verified hydraulic/commissioning schedule. Pump head alone is insufficient to establish local pressure.
- **Controls and hygiene:** the controller sequence, interlocks, installed nameplates, approved chemical regime, hygiene monitoring and groundwater permissions are absent.
- **Asset identity:** repeated tags are not unique asset IDs. Four S3 tanks belong to two different loops. Both restitution details are labelled R1.

This guide is descriptive. Temperature, pressure, dosing, safety-device and seasonal-bypass changes require approved documentation and the responsible qualified technician.

## Repository layout and deliverables

- **`src/` — source data, templates and generator:**
  - **[Hydraulic topology graph](src/data/plant-graph.json):** 79 instances/groups, 149 ports and 167 directed hydraulic edges, including the potable intake/booster/treatment train, open tap boundaries and warm stairwell recirculation loops.
  - **[Structured equipment & source register](src/data/plant-data.json):** component data, modes, caveats and references.
  - **[Trilingual content & tag glossary](src/data/lesson-content.json):** Italian, Simplified Chinese and English explanations and code sheets.
  - **[Interactive shell](src/templates/lesson.template.html)** and **[English technical-map shell](src/templates/site.template.html)**.
  - **[Diagram & animation engine](src/hydraulic-diagrams.mjs)** and **[static builder](src/build.mjs)**.
- **`diagrams/` — editable vector deliverables:**
  - **[Step 1 SVG](diagrams/connected-step1.svg)**, **[Step 2 SVG](diagrams/connected-step2.svg)**, **[Step 3 SVG](diagrams/connected-step3.svg)** and **[Cycle Zoom SVG](diagrams/connected-cycle.svg):** port-connected schematics editable in Inkscape.
  - **[Energy overview SVG](diagrams/energy-overview.svg)**, **[DHW circuits SVG](diagrams/dhw-circuits.svg)**, **[pressure-zone SVG](diagrams/pressure-zones.svg)**, **[three-page draw.io document](diagrams/plant-flows.drawio)** and **[diagram PDF](diagrams/plant-flows.pdf)**.
- **`documents/` — public manufacturer library:** **[public source register](documents/sources.json)** plus 15 downloaded technical PDFs with SHA-256 checksums; the original drawing is excluded.
- **`tests/` — automated verification:** [verify_graph.mjs](tests/verify_graph.mjs), [verify.py](tests/verify.py) and [verify_lesson.py](tests/verify_lesson.py).
- **`dist/` — generated website (gitignored, deployed via GitHub Actions):** `dist/index.html` (progressive 3-step guide), `dist/project.html` (English reference maps), `dist/plant-graph.json`, `dist/diagrams/*` and `dist/documents/*`.

The PDFs are unchanged reference copies. Manufacturer notices remain in place. The explanatory text and diagrams are newly authored; they are simplified functional views and omit installation details. The ELBI brochure is distributor-hosted; the other 14 downloads are from manufacturer domains.

## Editing and rebuilding

- Run `npm run build` (executes `node src/build.mjs`). No external Node packages are required. This validates the graph and translations, regenerates SVGs, draw.io source and `documents/sources.json`, and stages the clean `dist/` folder.
- Run `npm test` (executes `node --test tests/verify_graph.mjs`) for hydraulic isolation, parallel buffers, potable booster paths, open tap draw-off vs warm stairwell recirculation and projection connectivity.
- Run `npm run verify` (executes `python tests/verify_lesson.py`) for privacy, ordered browser locales, 90 step/language/season/viewport combinations (568 × 320 through 1440 × 900), continuous rAF animation, PC vs mobile detail visibility, header control fit, pipe-port accuracy, zero label overlaps, cycle zoom, interactive tag glossary highlighting and the portrait rotation + PC invitation screen in external Microsoft Edge.
- Run `python tests/verify.py` for the English technical-reference regression suite.
- Inkscape/draw.io edits can be made directly to the exported diagram files. **The build overwrites generated files**; preserve manual variants under separate names or incorporate changes in `src/hydraulic-diagrams.mjs` / `src/build.mjs`.

## Reading the topology graph

The graph records the normal hydraulic connections recovered from S00, page 1. A port reference such as `PC2.a/c.out` identifies an instance, a water channel and its outlet. Ordered `runs` create hydraulic edges; `sideBranches` represent pressure-vessel connections; `heatLinks` transfer energy across separated fluids. Instance suffixes distinguish repeated drawing tags and are documentation identifiers.

The source shows two S3 tanks **in parallel on each supply circuit**: one pair for climate water and one pair for the intermediate circuit. Each return bypasses its S3 pair. S4 vessels connect as side branches after filtration. SC2 separates primary and high-pressure water; SC1 separates primary and potable water.

Each non-teaching projection port maps to canonical graph ports, and each drawn external connection must have a supporting path in that graph. Overview symbols deliberately group equipment: the well includes extraction and treatment, PC2 groups two units, and the apartment symbol groups distribution. The portrait DHW boundary groups the intermediate buffers and hot-water chain. Desktop SC1/S2 represents the two charging branches equivalently; their separate MP/BP topology remains in the graph.

The graph records omissions and uncertainties explicitly. The refrigerant cycle is a teaching model because the original is a water schematic. Seasonal valve positions, emergency bypass operation and recovery priorities require verified control documentation.

Research date: **14 November 2026**. Current family brochures may describe equipment revisions different from the design drawing, whose latest visible date is 13 September 2023.
