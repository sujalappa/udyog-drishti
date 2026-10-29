# Udyog-drishti AI: research notes

Problem statement 3 for the Seva Innovation Challenge 2026:
**Sustainability - Energy, Climate and Others → Industrial decarbonisation, pollution control and wastewater reuse.**

Working name: **Udyog-drishti AI** ("udyog" = industry; same family as Van-, Pik- and Jal-drishti).

## The problem, with sources

| Fact | Source |
|---|---|
| India is the world's largest SO2 emitter since 2016, mainly from coal power plants | [Chen et al., AMT 19, 2737 (2026)](https://amt.copernicus.org/articles/19/2737/2026/) |
| 11 Jul 2025 notification: Category C plants (~78% of India's coal units) exempted from FGD; Category A must comply by Dec 2027; Category B case by case | [Health Policy Watch](https://healthpolicy-watch.news/india-reverses-key-policy-exempting-most-coal-fired-power-plants-from-emission-rules/); [Energy Monitor](https://www.energymonitor.ai/news/indias-government-sulphur-emission-rules-coal-fired-power-plants/) |
| Vidarbha: Koradi (2,400 MW), Khaparkheda (1,340 MW), Tiroda (3,300 MW), Mauda (2,320 MW) and others exempt; Chandrapur STPS and Paras in Category B | [The News Dirt, 16 Jul 2025](https://www.thenewsdirt.com/post/vidarbha-s-coal-plants-exempted-from-key-pollution-norms-in-2025-shift) |
| Chandrapur (132 kt/yr) and Koradi (114 kt/yr) among India's SO2 hotspots in NASA OMI data | [Greenpeace India, 2019](https://www.greenpeace.org/india/en/press/4015/india-largest-so2-emitter-in-the-world-says-greenpeaces-new-analysis/) |
| CSTPS Chandrapur asked in Jan 2026 for a review of its SO2 norm as a Category B plant | [Mahagenco EC compliance report, Jan–Jun 2026](https://www.mahagenco.in/clearance_pdf/MoEF&CC_Six%20Monthly%20EC%20Compliance%20report%20for%20period%20of%20Jan-2026%20to%20June-2026%20for%20CSTPS%20Chandrapur_20260806162706081.pdf) |
| Mahagenco FGD targets: Koradi 8–10 (3×660 MW) by May 2026; Paras 3–4 by Apr 2026; eight 500 MW units Jan–Jul 2026. No commissioning confirmation found | [Mahagenco annual reports 2023-24, 2024-25](https://www.mahagenco.in/tenderpdf/Mahagenco_English%20Final%20Annual%20Report%202024-2025%20(1)_20260721140107837.pdf) |
| CREA, 13 Jul 2026: around Delhi, 20 of 25 units with stack data exceeded SO2 norms, 12 had no data; 81% of SO2 from exempt plants. Asks for public real-time CEMS data | [CREA](https://energyandcleanair.org/publication/exempted-but-emitting-the-largest-so2-sources-around-delhi-ncr-continue-operating-without-control-technology/) |
| Stack monitors (OCEMS) are run by the industries themselves; only 20 of 32 states had public portals (2021); data quality is the biggest problem | [CEEW 2024](https://www.ceew.in/publications/continuous-emission-monitoring-systems-and-state-ocems-portals-india); [CSE via Down To Earth](https://www.downtoearth.org.in/news/pollution/only-50-of-india-s-pollution-authorities-make-real-time-data-public-cse-analysis-73885) |
| Nagpur exceeded the PM10 limit on 46 of 92 spring days in 2026; Koradi and Khaparkheda are the largest identified PM10 sources in the city inventory | [TechTimes, 11 Aug 2026](https://www.techtimes.com/articles/323894/20260811/nagpur-breathed-illegal-air-every-other-day-while-clean-air-funds-sat-half-unspent.htm) |
| Jun 2026: Nagpur's guardian minister orders "mission mode" disposal of Koradi/Khaparkheda pond ash | [The Hitavada, 8 Jun 2026](https://www.thehitavada.com/Encyc/2026/6/8/ash-disposal-from-koradi-and-khaparkheda-thermal-power-station-is-priority-chandrashekhar-bawankule.html) |
| 9 Maharashtra clusters are on CPCB's critically polluted list (CEPI): Tarapur 93.7, Chandrapur 76.4, Aurangabad, Dombivli, Nashik, Navi Mumbai and others | [CPCB CEPI action plans, 2020](https://cpcb.gov.in/industrial_pollution/New_Action_Plans/CEPI_Action%20Plan_Tarapur.pdf) |
| Tarapur MIDC: NGT restoration fund of ₹280 cr (2022); fishermen blame effluent for fish kills; MPCB crackdown and Assembly debate in 2026 | [Free Press Journal](https://www.freepressjournal.in/mumbai/palghar-millions-of-dead-fish-wash-ashore-fishermen-write-to-minister-pankaja-munde-seek-cmfri-probe-into-suspected-tarapur-midc-pollution); [Pudhari, 2026](https://pudhari.news/maharashtra/palghar/tarapur-midc-pollution-issue-raised-in-assembly-sb97) |
| Carbon Credit Trading Scheme: GHG-intensity targets for 490 industrial entities (aluminium, cement, chlor-alkali, paper, refinery, petrochemicals, textiles), 2023-24 baseline | [ICAP](https://icapcarbonaction.com/en/news/india-notifies-emission-intensity-targets-nine-sectors-under-carbon-credit-trading-scheme); [Business Standard, Jan 2026](https://www.business-standard.com/india-news/govt-notifies-ghg-emission-intensity-targets-for-four-industries-126012201311_1.html) |
| Mumbai's Kanjurmarg landfill: ~3,300 kg CH4/hr (Apr 2026), among the world's largest waste methane sources (Tanager-1, EMIT) | [Carbon Mapper](https://carbonmapper.org/articles/mumbai-waste-sites); [Down To Earth](https://www.downtoearth.org.in/waste/satellite-data-shows-secunderabad-and-mumbai-among-worlds-biggest-methane-emitting-landfill-sites-in-2025) |

## What satellites can and cannot see

- **Sentinel-5P TROPOMI (daily, ~5.5 × 3.5 km):** SO2 and NO2 columns. Big coal plants are visible as hotspots when averaged over months to years. Chen et al. (2026) detect ~80% of Indian coal plants above 100 MW with 5-year means (95% above 1,000 MW); the detection limit is ~10 kt/yr for one year.
- **Cannot see:** stack concentration in mg/Nm³ (the legal norm), night-only releases (TROPOMI passes at ~13:30), small units, or which of two neighbouring plants (Koradi vs Khaparkheda, 3 km apart) emitted.
- **Sentinel-2 / Landsat:** coloured or turbid effluent in creeks and nallahs below MIDCs; Landsat thermal for warm cooling-water discharge; ash pond extent.
- **Hyperspectral (EMIT, Tanager, PRISMA, EnMAP):** methane plumes from landfills and industry; scenes by request or on fixed tracks, so a later layer.

## Prior work and tools

- Chen, van der A et al. (KNMI/TU Delft), AMT 2026: super-resolution TROPOMI SO2 emissions over India; finds 22 unreported sources including the RCF Trombay sulphuric acid plant (2021) and Dhariwal near Chandrapur. Code on Zenodo (doi:10.5281/zenodo.19594746).
- MIT preprint (EGUsphere 2025-6008): global analysis of when power-plant NO2 plumes are visible in TROPOMI.
- Chen & Balamurugan (EGU25): TROPOMI NO2 emissions track daily coal burn at Indian plants.
- [Tycho](https://github.com/skoeb/tycho): GEE pipeline joining Sentinel-5P to the Global Power Plant Database.
- IIT Delhi (CERCA): satellite study on SO2-norm compliance of Indian plants.
- NRSC: Landsat-8 thermal mapping of a Gujarat plant's cooling-water outfall.
- Climate TRACE: satellite-based activity and CO2 estimates for steel and cement plants.

## Feasibility test (29 Oct 2026, Earth Engine, Sentinel-5P OFFL L3)

Enhancement = mean column within 15 km of the plant minus the median of a 40–80 km ring (µmol/m²), January–May each year (dry season, same months).

| Plant | Gas | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|
| Chandrapur STPS | SO2 | 281 | 286 | 240 | 232 |
| | NO2 | 88 | 97 | 90 | 106 |
| | SO2/NO2 | 3.2 | 3.0 | 2.7 | 2.2 |
| Koradi (+ Khaparkheda, 3 km away) | SO2 | 253 | 252 | 216 | 189 |
| | NO2 | 79 | 70 | 82 | 82 |
| | SO2/NO2 | 3.2 | 3.6 | 2.6 | 2.3 |
| Tiroda (Adani, no FGD) | SO2 | 194 | 162 | 147 | 116 |
| | NO2 | 42 | 32 | 27 | 27 |
| | SO2/NO2 | 4.6 | 5.0 | 5.5 | 4.4 |

- **The signal is strong:** SO2 near Chandrapur and Koradi is about double the ring background; NO2 about double too. Plant-level monthly/seasonal tracking is feasible.
- **Ratio fell at Chandrapur and Koradi** (about -30% since 2023) while NO2 (a load proxy, not removed by FGD) held or rose. Tiroda's ratio is flat within noise.
- **Do not claim FGD yet:** the Koradi drop starts in 2025, before the May 2026 FGD target. The ring background also fell ~35% over the same years, which may be a TROPOMI processor change or a real regional trend; ring subtraction removes an offset but not a scale change. Coal sulphur content also varies. The scrubber check needs a dated FGD start and a control set of plants without FGD.
- **Compute:** the GEE project hit its noncommercial monthly quota (150 EECU-hours) and is in restricted mode until 1 Nov 2026. Full-state, multi-year runs time out in restricted mode; small per-plant queries still work.

## Prototype results (29 Oct 2026, job c42988f42295)

- 17 sites: 14 coal power sites (22,020 MW in GPPD) and 3 industrial areas plus Chandrapur's cement belt; Jan 2019 to Sep 2026; ~1 min for the numbers, ~3 min for the two maps (project curious-subject-513110-r4).
- **Check first (5):** Chandrapur STPS + Dhariwal (SO₂ 238 µmol/m² above background), Koradi + Khaparkheda (190), Warora (169), Tiroda (161), Ghugus–Rajura cement belt (SO₂ +28% vs 2021-2024; may include Chandrapur's plume 25 km north).
- **Reference plants behave as expected:** Dahanu (seawater FGD) shows SO₂ ≈ 0 with NO₂ visible; Trombay (seawater FGD + Mumbai NO₂) ratio 0.7; exempt Tiroda and Warora ratio ~4.9.
- **Mauda found from space:** NTPC Mauda's SO₂ ÷ NO₂ fell from 4.6 (Jun 2024) to 2.9 (Jun 2025) and 2.0 (Jun 2026) while Tiroda stayed ~4.5. Scrubber check from Jan 2025: ratio 4.54 → 2.80 (−38%), exempt plants −8%, net −30%. Afterwards confirmed: NTPC Mauda's FGD and gypsum units are in service ([The Live Nagpur, 23 Oct 2026](https://thelivenagpur.com/2026/10/23/ntpc-mouda-conducts-awareness-programme-on-best-environmental-practices-in-collaboration-with-mpcb/); wet limestone FGD by [Mitsubishi Power](https://power.mhi.com/regions/ind/projects/mouda)). Mauda is Category C (exempt) but built FGD anyway.
- **Koradi:** net −5% after May 2026 (FGD target): no clear scrubber signal yet; recheck after a full dry season.
- **Tiroda placebo** (no scrubber, date Jun 2025): net change +0.1%.
